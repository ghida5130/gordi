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
5. Persist the image under the result directory and send ``SUCCEEDED``
   with its public URL — any failure sends ``FAILED`` instead.

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
    """Raised when a try-on job cannot be processed."""


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
            raise TryOnJobError("try-on generation needs an API key")
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
    """POST /internal/v1/try-on-jobs/{jobId}/events with the shared token."""

    def __init__(
        self,
        *,
        base_url: str,
        internal_token: str,
        client: httpx.Client | None = None,
        timeout_seconds: float = 10.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._headers = {}
        if internal_token.strip():
            self._headers["X-Internal-Token"] = internal_token.strip()
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


@dataclass
class TryOnJobProcessor:
    generator: ImageGenerator
    event_sender: EventSender
    image_fetcher: QueryImageFetcher
    result_dir: Path
    result_base_url: str
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
            emit("PROCESSING")
            parts = self._build_parts(request)
            content, mime_type = self.generator.generate(parts)
            image_url, width, height = self._persist_result(
                job_id,
                content,
                mime_type,
            )
            emit(
                "SUCCEEDED",
                result={
                    "imageUrl": image_url,
                    "width": width,
                    "height": height,
                    "fitSummary": _fit_summary(request.items),
                    "disclaimer": (
                        "AI 생성 이미지로 실제 착용감과 다를 수 있습니다."
                    ),
                },
                cacheHit=False,
            )
        except Exception as exc:  # noqa: BLE001 — job isolation
            logger.exception("try-on job %s failed", job_id)
            try:
                emit(
                    "FAILED",
                    error={
                        "code": "GENERATION_FAILED",
                        "message": str(exc)[:255],
                        "retryable": True,
                    },
                )
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
        self.result_dir.mkdir(parents=True, exist_ok=True)
        (self.result_dir / filename).write_bytes(content)
        width = height = None
        try:
            from io import BytesIO

            from PIL import Image

            with Image.open(BytesIO(content)) as image:
                width, height = image.size
        except Exception:  # noqa: BLE001 — size is best-effort metadata
            width = height = None
        return (
            f"{self.result_base_url.rstrip('/')}/{filename}",
            width,
            height,
        )


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


class TryOnJobRegistry:
    """Per-process idempotency guard for accepted job ids."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._accepted: set[int] = set()

    def try_accept(self, job_id: int) -> bool:
        with self._lock:
            if job_id in self._accepted:
                return False
            self._accepted.add(job_id)
            return True

    def reset(self) -> None:
        with self._lock:
            self._accepted.clear()


job_registry = TryOnJobRegistry()


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
            internal_token=settings.internal_token,
        ),
        image_fetcher=QueryImageFetcher.create(
            settings.recommendation_image_allowed_hosts
        ),
        result_dir=settings.tryon_result_dir,
        result_base_url=settings.tryon_result_base_url,
        model_version=settings.tryon_image_model,
    )


__all__ = [
    "OpenRouterImageGenerator",
    "PROMPT_VERSION",
    "SpringEventSender",
    "TryOnJobError",
    "TryOnJobProcessor",
    "TryOnJobRegistry",
    "build_processor",
    "job_registry",
]
