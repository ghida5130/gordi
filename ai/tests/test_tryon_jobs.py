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
from app.schemas.tryon import TryOnGenerationRequest
from app.services.tryon_jobs import (
    PROMPT_VERSION,
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
        result_dir=tmp_path / "results",
        result_base_url="http://localhost:8000/try-on-results",
        model_version="google/gemini-3-pro-image",
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


def test_processor_failure_emits_failed_event(tmp_path: Path) -> None:
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
    assert duplicate.status_code == 202
    processing = [
        event
        for event in sender.events
        if event["eventType"] == "PROCESSING"
    ]
    assert len(processing) == 1


def test_submit_endpoint_requires_matching_token(
    clean_registry: None,
) -> None:
    settings = Settings(internal_token="secret-token")
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        denied = client.post(
            "/internal/v1/try-on-jobs",
            json=java_payload(31),
            headers={"X-Internal-Token": "wrong"},
        )
    finally:
        app.dependency_overrides.clear()

    assert denied.status_code == 401


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
