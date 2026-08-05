"""Try-on job processing: prompt assembly, generation, Spring callbacks.

Flow per accepted job (async to the submit request):

1. ``PROCESSING`` event to Spring.
2. Fetch the avatar photo and each garment's primary photo through the
   allowlisted fetcher (SSRF rules identical to the query-image path).
3. Assemble the fit-aware prompt with the role separation validated in
   the team's blind evaluation: the avatar is ``PERSON BASE`` (the only
   authority on face/body/pose), garment photos are ``GARMENT ONLY``
   (color/pattern/material/cut only).
4. Generate one image through OpenRouter (Nano Banana 2 by default).
5. Persist the image — S3 (prod: CloudFront 조합 공개 URL) 또는 로컬
   디스크(/try-on-results 서빙) — and send ``SUCCEEDED`` with a URL
   the frontend can use as-is; any failure sends ``FAILED`` instead.
   Spring 은 result.imageUrl 을 가공 없이 저장·서빙하므로 여기서
   내보내는 URL 이 곧 사용자가 받는 URL 이다.

Idempotency is in-memory per process, matching Spring's one-submit-
per-job contract; a duplicate submit is acknowledged and ignored.
"""

from __future__ import annotations

import base64
import binascii
import logging
import re
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

import httpx

from app.core.config import get_settings
from app.recommendation.image_fetcher import QueryImageFetcher
from app.schemas.tryon import (
    SizeProfile,
    TryOnGenerationRequest,
    TryOnItem,
)

logger = logging.getLogger(__name__)

PROMPT_VERSION = "tryon-fastapi-v1"
_DATA_URL_PATTERN = re.compile(
    r"^data:(image/(?:png|jpeg));base64,(.+)$",
    re.DOTALL,
)

_TOP_FIT_FIELDS = (
    ("total_length", "total length"),
    ("shoulder_width", "shoulder width"),
    ("chest_width", "chest width"),
    ("sleeve_length", "sleeve length"),
)
_BOTTOM_FIT_FIELDS = (
    ("total_length", "total length"),
    ("waist_width", "waist width"),
    ("hip_width", "hip width"),
    ("thigh_width", "thigh width"),
    ("rise", "rise"),
)


class TryOnJobError(RuntimeError):
    """Raised when a try-on job cannot be processed.

    ``retryable`` defaults to ``True`` because most generation failures
    (network, upstream 5xx, model nondeterminism) may pass on retry;
    configuration errors must pass ``retryable=False`` explicitly.
    """

    def __init__(self, message: str, *, retryable: bool = True) -> None:
        super().__init__(message)
        self.retryable = retryable


class ImageGenerator(Protocol):
    def generate(
        self,
        parts: list[dict[str, Any]],
    ) -> tuple[bytes, str]:
        """Return (image bytes, mime type) for one generation request."""


class EventSender(Protocol):
    def send(self, job_id: int, payload: dict[str, Any]) -> None:
        """Deliver one job event to Spring."""


class OpenRouterImageGenerator:
    """OpenRouter chat-completions image generation adapter."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        timeout_seconds: float,
        endpoint: str = "https://openrouter.ai/api/v1/chat/completions",
        client: httpx.Client | None = None,
    ) -> None:
        if not api_key.strip():
            raise TryOnJobError(
                "try-on generation needs an API key",
                retryable=False,
            )
        self._model = model
        self._endpoint = endpoint
        self._headers = {"Authorization": f"Bearer {api_key}"}
        self._client = client or httpx.Client(timeout=timeout_seconds)

    def generate(
        self,
        parts: list[dict[str, Any]],
    ) -> tuple[bytes, str]:
        payload = {
            "model": self._model,
            "messages": [{"role": "user", "content": parts}],
            "modalities": ["image", "text"],
        }
        try:
            response = self._client.post(
                self._endpoint,
                headers=self._headers,
                json=payload,
            )
        except httpx.HTTPError as exc:
            raise TryOnJobError(
                f"generation request failed: {type(exc).__name__}"
            ) from exc
        if not response.is_success:
            raise TryOnJobError(
                f"generation failed with status {response.status_code}"
            )
        try:
            body = response.json()
            images = body["choices"][0]["message"].get("images") or []
            data_url = images[0]["image_url"]["url"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise TryOnJobError(
                "generation response contained no image"
            ) from exc
        matched = _DATA_URL_PATTERN.match(str(data_url))
        if matched is None:
            raise TryOnJobError("generated image is not a PNG/JPEG data URL")
        try:
            content = base64.b64decode(matched.group(2), validate=True)
        except (binascii.Error, ValueError) as exc:
            raise TryOnJobError("generated image base64 invalid") from exc
        return content, matched.group(1)


class SpringEventSender:
    """POST /internal/v1/try-on-jobs/{jobId}/events with the shared key."""

    def __init__(
        self,
        *,
        base_url: str,
        internal_api_key: str,
        client: httpx.Client | None = None,
        timeout_seconds: float = 10.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._headers = {}
        if internal_api_key.strip():
            self._headers["X-Internal-Api-Key"] = internal_api_key.strip()
        self._client = client or httpx.Client(timeout=timeout_seconds)

    def send(self, job_id: int, payload: dict[str, Any]) -> None:
        url = f"{self._base_url}/internal/v1/try-on-jobs/{job_id}/events"
        last_error: Exception | None = None
        for _ in range(2):
            try:
                response = self._client.post(
                    url,
                    headers=self._headers,
                    json=payload,
                )
                if response.is_success:
                    return
                last_error = TryOnJobError(
                    f"event callback status {response.status_code}"
                )
            except httpx.HTTPError as exc:
                last_error = exc
        raise TryOnJobError(
            f"event callback failed: {last_error}"
        ) from last_error


class ResultStore(Protocol):
    def store(
        self,
        filename: str,
        content: bytes,
        mime_type: str,
    ) -> str:
        """Persist one result image and return its public URL."""


class LocalResultStore:
    """Write under the result dir, served by the /try-on-results route."""

    def __init__(self, *, result_dir: Path, base_url: str) -> None:
        self._result_dir = result_dir
        self._base_url = base_url.rstrip("/")

    def store(
        self,
        filename: str,
        content: bytes,
        mime_type: str,
    ) -> str:
        self._result_dir.mkdir(parents=True, exist_ok=True)
        (self._result_dir / filename).write_bytes(content)
        return f"{self._base_url}/{filename}"


class S3ResultStore:
    """Upload to the private bucket and return the CloudFront-joined URL.

    가먼트 이미지와 같은 배포 구조: 버킷은 비공개, 공개 접근은
    CloudFront(public base)로만 한다. 그래서 public base 없이 버킷만
    설정된 경우는 사용자가 열 수 없는 URL 이 나가므로 생성 시점에
    거부한다.
    """

    def __init__(
        self,
        *,
        bucket: str,
        key_prefix: str,
        public_base_url: str,
        client: Any | None = None,
    ) -> None:
        if not public_base_url.strip():
            raise TryOnJobError(
                "TRYON_RESULT_PUBLIC_BASE_URL is required when "
                "TRYON_S3_BUCKET is set (private bucket needs a "
                "CloudFront base)",
                retryable=False,
            )
        if client is None:
            import boto3

            client = boto3.client("s3")
        self._client = client
        self._bucket = bucket
        self._key_prefix = key_prefix.strip("/")
        self._public_base_url = public_base_url.rstrip("/")

    def store(
        self,
        filename: str,
        content: bytes,
        mime_type: str,
    ) -> str:
        key = f"{self._key_prefix}/{filename}"
        try:
            self._client.put_object(
                Bucket=self._bucket,
                Key=key,
                Body=content,
                ContentType=mime_type,
            )
        except Exception as exc:  # noqa: BLE001 — boto 예외 전 계열
            raise TryOnJobError(
                f"result upload to s3 failed: {type(exc).__name__}"
            ) from exc
        return f"{self._public_base_url}/{key}"


@dataclass
class TryOnJobProcessor:
    generator: ImageGenerator
    event_sender: EventSender
    image_fetcher: QueryImageFetcher
    result_store: ResultStore
    model_version: str

    def process(self, request: TryOnGenerationRequest) -> None:
        job_id = request.job_id
        sequence = 0

        def emit(event_type: str, **extra: Any) -> None:
            nonlocal sequence
            sequence += 1
            self.event_sender.send(
                job_id,
                {
                    "eventId": str(uuid.uuid4()),
                    "sequence": sequence,
                    "eventType": event_type,
                    "attempt": 1,
                    "modelVersion": self.model_version,
                    "promptVersion": PROMPT_VERSION,
                    "occurredAt": datetime.now(timezone.utc).isoformat(),
                    **extra,
                },
            )

        try:
            job_registry.mark_running(job_id)
            emit("PROCESSING")
            parts = self._build_parts(request)
            content, mime_type = self.generator.generate(parts)
            image_url, width, height = self._persist_result(
                job_id,
                content,
                mime_type,
            )
            result = {
                "imageUrl": image_url,
                "width": width,
                "height": height,
                "fitSummary": _fit_summary(request.items),
                "disclaimer": (
                    "AI 생성 이미지로 실제 착용감과 다를 수 있습니다."
                ),
            }
            job_registry.mark_succeeded(
                job_id,
                result=result,
                model_version=self.model_version,
            )
            emit("SUCCEEDED", result=result, cacheHit=False)
        except Exception as exc:  # noqa: BLE001 — job isolation
            logger.exception("try-on job %s failed", job_id)
            error = {
                "code": "GENERATION_FAILED",
                "message": str(exc)[:255],
                # 검증·설정 오류(비허용 호스트 등)는 재시도해도 같은 실패라
                # 예외가 스스로 밝힌 retryable 을 그대로 전달한다.
                "retryable": bool(getattr(exc, "retryable", True)),
            }
            job_registry.mark_failed(
                job_id,
                error=error,
                model_version=self.model_version,
            )
            try:
                emit("FAILED", error=error)
            except Exception:  # noqa: BLE001
                logger.exception(
                    "try-on job %s FAILED event delivery failed", job_id
                )

    def _build_parts(
        self,
        request: TryOnGenerationRequest,
    ) -> list[dict[str, Any]]:
        parts: list[dict[str, Any]] = [
            {"type": "text", "text": _prompt_header(request)},
            {"type": "text", "text": "PERSON BASE (아바타):"},
            self._image_part(request.avatar.image_url),
        ]
        for index, item in enumerate(request.items, start=1):
            parts.append(
                {
                    "type": "text",
                    "text": _garment_instruction(index, item),
                }
            )
            parts.append(self._image_part(item.image_url))
        return parts

    def _image_part(self, url: str) -> dict[str, Any]:
        resolved = self.image_fetcher.fetch(url)
        encoded = base64.b64encode(resolved.content).decode("ascii")
        return {
            "type": "image_url",
            "image_url": {
                "url": f"data:{resolved.mime_type};base64,{encoded}"
            },
        }

    def _persist_result(
        self,
        job_id: int,
        content: bytes,
        mime_type: str,
    ) -> tuple[str, int | None, int | None]:
        extension = ".png" if mime_type == "image/png" else ".jpg"
        filename = f"job-{job_id}{extension}"
        image_url = self.result_store.store(filename, content, mime_type)
        width = height = None
        try:
            from io import BytesIO

            from PIL import Image

            with Image.open(BytesIO(content)) as image:
                width, height = image.size
        except Exception:  # noqa: BLE001 — size is best-effort metadata
            width = height = None
        return image_url, width, height


def _prompt_header(request: TryOnGenerationRequest) -> str:
    avatar = request.avatar
    lines = [
        "Task: dress the PERSON BASE in the provided garments as one "
        "photorealistic full-body try-on shot.",
        "PERSON BASE is the only authority on face, skin, hair, body "
        "shape, proportions, pose, and camera. Never copy a person, "
        "pose, or body from any garment reference.",
        "GARMENT ONLY images provide color, logo, pattern, material, "
        "and cut of each garment. Ignore any person, skin, hair, or "
        "other clothing visible in them.",
        "If inputs conflict, PERSON BASE always wins.",
    ]
    profile = []
    if avatar.gender:
        profile.append(f"gender={avatar.gender}")
    if avatar.body_type:
        profile.append(f"bodyType={avatar.body_type}")
    if avatar.min_height and avatar.max_height:
        profile.append(
            f"height {avatar.min_height}-{avatar.max_height}cm"
        )
    if avatar.min_weight and avatar.max_weight:
        profile.append(
            f"weight {avatar.min_weight}-{avatar.max_weight}kg"
        )
    if profile:
        lines.append("Avatar profile: " + ", ".join(profile) + ".")
    wear = request.wear_options
    if wear is not None:
        styling = [
            f"{label}={value}"
            for label, value in (
                ("top tuck", wear.top_tuck),
                ("outer closure", wear.outer_closure),
                ("sleeves", wear.sleeves),
            )
            if value
        ]
        if styling:
            lines.append("Styling: " + ", ".join(styling) + ".")
    if request.prompt:
        lines.append(f"Extra note: {request.prompt}")
    return "\n".join(lines)


def _garment_instruction(index: int, item: TryOnItem) -> str:
    lines = [
        f"GARMENT ONLY #{index} — slot {item.slot}. Use only this "
        "garment's color, pattern, material, and cut.",
    ]
    if item.description:
        lines.append(f"Description: {item.description}")
    fit = _fit_line(item)
    if fit:
        lines.append(fit)
    return "\n".join(lines)


def _fit_line(item: TryOnItem) -> str | None:
    profile = item.size_profile
    if profile is None:
        return None
    fields = (
        _BOTTOM_FIT_FIELDS
        if item.slot.upper() == "BOTTOM"
        else _TOP_FIT_FIELDS
    )
    measurements = [
        f"{label} {getattr(profile, field)}cm"
        for field, label in fields
        if getattr(profile, field) is not None
    ]
    if not measurements:
        return None
    size_name = f" (size {profile.size_name})" if profile.size_name else ""
    return (
        f"Selected size{size_name} measurements: "
        + ", ".join(measurements)
        + ". Render the fit these measurements imply on this body."
    )


def _fit_summary(items: list[TryOnItem]) -> list[str]:
    summary = []
    for item in items:
        profile = item.size_profile
        if profile is not None and profile.size_name:
            summary.append(f"{item.slot}: {profile.size_name}")
    return summary


@dataclass
class TryOnJobRecord:
    """Job state exposed to Spring's GET recovery worker."""

    job_id: int
    created_at: str
    status: str = "QUEUED"  # QUEUED / RUNNING / SUCCEEDED / FAILED
    attempt: int = 1  # AI 내부 자동 재시도 없음 — 항상 1
    cache_hit: bool = False
    result: dict[str, Any] | None = None
    error: dict[str, Any] | None = None
    model_version: str | None = None
    completed_at: str | None = None


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class TryOnJobRegistry:
    """Per-process idempotency guard and job state store.

    In-memory on purpose: after a restart Spring's recovery worker gets
    404 for lost jobs and fails them — the documented reconciliation
    contract ("AI 가 모르는 Job").
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._jobs: dict[int, TryOnJobRecord] = {}

    def try_accept(self, job_id: int) -> bool:
        with self._lock:
            if job_id in self._jobs:
                return False
            self._jobs[job_id] = TryOnJobRecord(
                job_id=job_id,
                created_at=_utc_now(),
            )
            return True

    def get(self, job_id: int) -> TryOnJobRecord | None:
        with self._lock:
            return self._jobs.get(job_id)

    def mark_running(self, job_id: int) -> None:
        with self._lock:
            self._record(job_id).status = "RUNNING"

    def mark_succeeded(
        self,
        job_id: int,
        *,
        result: dict[str, Any],
        model_version: str,
    ) -> None:
        with self._lock:
            record = self._record(job_id)
            record.status = "SUCCEEDED"
            record.result = result
            record.model_version = model_version
            record.completed_at = _utc_now()

    def mark_failed(
        self,
        job_id: int,
        *,
        error: dict[str, Any],
        model_version: str,
    ) -> None:
        with self._lock:
            record = self._record(job_id)
            record.status = "FAILED"
            record.error = error
            record.model_version = model_version
            record.completed_at = _utc_now()

    def _record(self, job_id: int) -> TryOnJobRecord:
        # 접수 없이 process() 가 직접 불린 경우(테스트)에도 기록한다.
        record = self._jobs.get(job_id)
        if record is None:
            record = TryOnJobRecord(job_id=job_id, created_at=_utc_now())
            self._jobs[job_id] = record
        return record

    def reset(self) -> None:
        with self._lock:
            self._jobs.clear()


job_registry = TryOnJobRegistry()


def build_result_store(settings: Any = None) -> ResultStore:
    settings = settings or get_settings()
    if settings.tryon_s3_bucket.strip():
        return S3ResultStore(
            bucket=settings.tryon_s3_bucket.strip(),
            key_prefix=settings.tryon_s3_key_prefix,
            public_base_url=settings.tryon_result_public_base_url,
        )
    return LocalResultStore(
        result_dir=settings.tryon_result_dir,
        base_url=settings.tryon_result_base_url,
    )


def build_processor() -> TryOnJobProcessor:
    settings = get_settings()
    api_key = settings.openrouter_api_key.strip()
    return TryOnJobProcessor(
        generator=OpenRouterImageGenerator(
            api_key=api_key,
            model=settings.tryon_image_model,
            timeout_seconds=settings.tryon_generation_timeout_seconds,
        ),
        event_sender=SpringEventSender(
            base_url=settings.spring_internal_base_url,
            internal_api_key=settings.internal_api_key,
        ),
        image_fetcher=QueryImageFetcher.create(
            settings.recommendation_image_allowed_hosts
        ),
        result_store=build_result_store(settings),
        model_version=settings.tryon_image_model,
    )


__all__ = [
    "LocalResultStore",
    "OpenRouterImageGenerator",
    "PROMPT_VERSION",
    "S3ResultStore",
    "SpringEventSender",
    "TryOnJobError",
    "TryOnJobProcessor",
    "TryOnJobRecord",
    "TryOnJobRegistry",
    "build_processor",
    "build_result_store",
    "job_registry",
]
