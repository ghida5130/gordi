from __future__ import annotations

import io
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.api.routes.internal_tryon import get_tryon_processor
from app.core.config import Settings, get_settings
from app.main import app
from app.recommendation.catalog_embeddings import ResolvedImage
from app.recommendation.image_fetcher import QueryImageError
from app.schemas.tryon import TryOnGenerationRequest
from app.services.tryon_jobs import (
    PROMPT_VERSION,
    LocalResultStore,
    S3ResultStore,
    TryOnJobError,
    TryOnJobProcessor,
    job_registry,
)

client = TestClient(app)


def png_bytes(size: tuple[int, int] = (32, 48)) -> bytes:
    output = io.BytesIO()
    Image.new("RGB", size, "purple").save(output, format="PNG")
    return output.getvalue()


def java_payload(job_id: int = 7) -> dict[str, Any]:
    return {
        "jobId": job_id,
        "context": {"type": "ROOM", "roomId": 3, "boardVersion": 12},
        "avatar": {
            "avatarId": 5,
            "imageUrl": "http://gordi-nginx/avatars/5.png",
            "gender": "FEMALE",
            "bodyType": "STANDARD",
            "minHeight": 160,
            "maxHeight": 165,
            "minWeight": 50,
            "maxWeight": 55,
        },
        "items": [
            {
                "productId": 11,
                "slot": "TOP",
                "imageUrl": "http://gordi-nginx/garments/11.jpg",
                "source": "MUSINSA",
                "description": "슬림 폴로 니트",
                "sizeProfile": {
                    "sizeName": "M",
                    "totalLength": "58.5",
                    "shoulderWidth": "38.0",
                    "chestWidth": "44.0",
                    "sleeveLength": "58.0",
                },
            },
            {
                "productId": 12,
                "slot": "BOTTOM",
                "imageUrl": "http://gordi-nginx/garments/12.jpg",
                "source": "MUSINSA",
                "description": "와이드 슬랙스",
                "sizeProfile": {
                    "sizeName": "L",
                    "totalLength": "102.0",
                    "waistWidth": "36.0",
                    "hipWidth": "52.0",
                },
            },
        ],
        "wearOptions": {
            "topTuck": "FULL_TUCK",
            "outerClosure": None,
            "sleeves": "ROLLED",
        },
        "prompt": "자연광 느낌",
    }


class FakeFetcher:
    def __init__(self) -> None:
        self.urls: list[str] = []

    def fetch(self, url: str) -> ResolvedImage:
        self.urls.append(url)
        return ResolvedImage(
            content=png_bytes((8, 8)),
            mime_type="image/png",
            sha256="0" * 64,
        )


class RejectingFetcher:
    """비허용 호스트 거부처럼 재시도해도 똑같이 실패하는 fetcher."""

    def fetch(self, url: str) -> ResolvedImage:
        raise QueryImageError(
            "query image host is not allowed: evil.example"
        )


class FakeGenerator:
    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.parts: list[dict[str, Any]] | None = None

    def generate(
        self,
        parts: list[dict[str, Any]],
    ) -> tuple[bytes, str]:
        self.parts = parts
        if self.fail:
            raise TryOnJobError("model unavailable")
        return png_bytes(), "image/png"


class FakeSender:
    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []

    def send(self, job_id: int, payload: dict[str, Any]) -> None:
        self.events.append({"job_id": job_id, **payload})


def make_processor(
    tmp_path: Path,
    *,
    fail: bool = False,
) -> tuple[TryOnJobProcessor, FakeGenerator, FakeSender, FakeFetcher]:
    generator = FakeGenerator(fail=fail)
    sender = FakeSender()
    fetcher = FakeFetcher()
    processor = TryOnJobProcessor(
        generator=generator,
        event_sender=sender,
        image_fetcher=fetcher,
        result_store=LocalResultStore(
            result_dir=tmp_path / "results",
            base_url="http://localhost:8000/try-on-results",
        ),
        model_version="google/gemini-3.1-flash-image",
    )
    return processor, generator, sender, fetcher


def test_schema_parses_spring_shaped_payload() -> None:
    request = TryOnGenerationRequest.model_validate(java_payload())

    assert request.job_id == 7
    assert request.avatar.image_url.endswith("/avatars/5.png")
    assert request.items[1].size_profile.waist_width is not None
    assert request.wear_options.top_tuck == "FULL_TUCK"


def test_processor_success_emits_processing_then_succeeded(
    tmp_path: Path,
    clean_registry: None,
) -> None:
    processor, generator, sender, fetcher = make_processor(tmp_path)
    request = TryOnGenerationRequest.model_validate(java_payload())

    processor.process(request)

    assert [event["eventType"] for event in sender.events] == [
        "PROCESSING",
        "SUCCEEDED",
    ]
    succeeded = sender.events[1]
    assert succeeded["sequence"] == 2
    assert succeeded["promptVersion"] == PROMPT_VERSION
    result = succeeded["result"]
    assert result["imageUrl"] == (
        "http://localhost:8000/try-on-results/job-7.png"
    )
    assert result["width"] == 32 and result["height"] == 48
    assert result["fitSummary"] == ["TOP: M", "BOTTOM: L"]
    assert (tmp_path / "results" / "job-7.png").is_file()
    # avatar + 2 garments fetched through the allowlisted fetcher
    assert len(fetcher.urls) == 3

    texts = " ".join(
        part["text"]
        for part in generator.parts
        if part["type"] == "text"
    )
    assert "PERSON BASE" in texts
    assert "GARMENT ONLY #1" in texts
    assert "waist width 36.0cm" in texts
    assert "top tuck=FULL_TUCK" in texts
    assert "자연광 느낌" in texts


def test_processor_failure_emits_failed_event(
    tmp_path: Path,
    clean_registry: None,
) -> None:
    processor, _, sender, _ = make_processor(tmp_path, fail=True)
    request = TryOnGenerationRequest.model_validate(java_payload(8))

    processor.process(request)

    assert [event["eventType"] for event in sender.events] == [
        "PROCESSING",
        "FAILED",
    ]
    error = sender.events[1]["error"]
    assert error["code"] == "GENERATION_FAILED"
    assert error["retryable"] is True
    assert "model unavailable" in error["message"]
    record = job_registry.get(8)
    assert record is not None and record.status == "FAILED"
    assert record.error["code"] == "GENERATION_FAILED"


def test_processor_marks_config_errors_not_retryable(
    tmp_path: Path,
    clean_registry: None,
) -> None:
    processor, _, sender, _ = make_processor(tmp_path)
    processor.image_fetcher = RejectingFetcher()
    request = TryOnGenerationRequest.model_validate(java_payload(9))

    processor.process(request)

    assert [event["eventType"] for event in sender.events] == [
        "PROCESSING",
        "FAILED",
    ]
    error = sender.events[1]["error"]
    assert error["retryable"] is False
    assert "not allowed" in error["message"]
    record = job_registry.get(9)
    assert record is not None and record.status == "FAILED"
    assert record.error["retryable"] is False


@pytest.fixture
def clean_registry():
    job_registry.reset()
    yield
    job_registry.reset()


def test_submit_endpoint_runs_job_once(
    tmp_path: Path,
    clean_registry: None,
) -> None:
    processor, _, sender, _ = make_processor(tmp_path)
    app.dependency_overrides[get_tryon_processor] = lambda: processor
    try:
        first = client.post(
            "/internal/v1/try-on-jobs",
            json=java_payload(21),
        )
        duplicate = client.post(
            "/internal/v1/try-on-jobs",
            json=java_payload(21),
        )
    finally:
        app.dependency_overrides.clear()

    assert first.status_code == 202
    assert first.json() == {
        "data": {"jobId": 21, "status": "QUEUED", "cacheHit": False}
    }
    assert duplicate.status_code == 202
    # TestClient 는 BackgroundTasks 를 응답 전에 실행하므로 중복 접수
    # 시점엔 이미 종료 상태다 — 본문이 현재 상태를 그대로 비추는지 확인.
    assert duplicate.json()["data"] == {
        "jobId": 21,
        "status": "SUCCEEDED",
        "cacheHit": False,
    }
    processing = [
        event
        for event in sender.events
        if event["eventType"] == "PROCESSING"
    ]
    assert len(processing) == 1


def test_submit_endpoint_requires_matching_api_key(
    clean_registry: None,
) -> None:
    settings = Settings(internal_api_key="secret-key")
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        denied = client.post(
            "/internal/v1/try-on-jobs",
            json=java_payload(31),
            headers={"X-Internal-Api-Key": "wrong"},
        )
    finally:
        app.dependency_overrides.clear()

    assert denied.status_code == 401


def test_status_endpoint_returns_terminal_job(
    tmp_path: Path,
    clean_registry: None,
) -> None:
    processor, _, _, _ = make_processor(tmp_path)
    app.dependency_overrides[get_tryon_processor] = lambda: processor
    try:
        client.post("/internal/v1/try-on-jobs", json=java_payload(41))
        found = client.get("/internal/v1/try-on-jobs/41")
    finally:
        app.dependency_overrides.clear()

    assert found.status_code == 200
    data = found.json()["data"]
    assert data["jobId"] == 41
    assert data["status"] == "SUCCEEDED"
    assert data["attempt"] == 1
    assert data["cacheHit"] is False
    assert data["result"]["imageUrl"] == (
        "http://localhost:8000/try-on-results/job-41.png"
    )
    assert data["error"] is None
    assert data["modelVersion"] == "google/gemini-3.1-flash-image"
    assert data["promptVersion"] == PROMPT_VERSION
    assert data["createdAt"] and data["completedAt"]


def test_status_endpoint_unknown_job_returns_404(
    clean_registry: None,
) -> None:
    missing = client.get("/internal/v1/try-on-jobs/999999")

    assert missing.status_code == 404


def test_result_route_serves_saved_images(tmp_path: Path) -> None:
    settings = Settings(tryon_result_dir=tmp_path)
    (tmp_path / "job-9.png").write_bytes(png_bytes())
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        found = client.get("/try-on-results/job-9.png")
        traversal = client.get("/try-on-results/..%2fsecret.png")
        missing = client.get("/try-on-results/job-404.png")
    finally:
        app.dependency_overrides.clear()

    assert found.status_code == 200
    assert found.content == (tmp_path / "job-9.png").read_bytes()
    assert traversal.status_code in {400, 404}
    assert missing.status_code == 404


def test_result_route_also_mounted_under_api_prefix(tmp_path: Path) -> None:
    # 운영 nginx 가 /ai/ 만 프록시하므로 API prefix 경로로도 서빙돼야 한다.
    settings = Settings(tryon_result_dir=tmp_path)
    (tmp_path / "job-9.png").write_bytes(png_bytes())
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        prefixed = client.get(
            f"{settings.api_prefix}/try-on-results/job-9.png"
        )
    finally:
        app.dependency_overrides.clear()

    assert prefixed.status_code == 200
    assert prefixed.content == (tmp_path / "job-9.png").read_bytes()


class FakeS3Client:
    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.calls: list[dict[str, Any]] = []

    def put_object(self, **kwargs: Any) -> None:
        if self.fail:
            raise RuntimeError("s3 unavailable")
        self.calls.append(kwargs)


def test_s3_result_store_uploads_and_joins_public_base() -> None:
    s3 = FakeS3Client()
    store = S3ResultStore(
        bucket="gordi-app-bucket",
        key_prefix="fittings",
        public_base_url="https://cdn.example.net/",
        client=s3,
    )

    url = store.store("job-7.png", b"png-bytes", "image/png")

    assert url == "https://cdn.example.net/fittings/job-7.png"
    assert s3.calls == [
        {
            "Bucket": "gordi-app-bucket",
            "Key": "fittings/job-7.png",
            "Body": b"png-bytes",
            "ContentType": "image/png",
        }
    ]


def test_s3_result_store_requires_public_base() -> None:
    with pytest.raises(TryOnJobError) as excinfo:
        S3ResultStore(
            bucket="gordi-app-bucket",
            key_prefix="fittings",
            public_base_url="",
            client=FakeS3Client(),
        )
    assert excinfo.value.retryable is False


def test_s3_result_store_upload_failure_is_retryable() -> None:
    store = S3ResultStore(
        bucket="gordi-app-bucket",
        key_prefix="fittings",
        public_base_url="https://cdn.example.net",
        client=FakeS3Client(fail=True),
    )
    with pytest.raises(TryOnJobError) as excinfo:
        store.store("job-8.jpg", b"jpg-bytes", "image/jpeg")
    assert excinfo.value.retryable is True
