from __future__ import annotations

import io
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.api.dependencies import (
    require_recommendation_demo,
    require_recommendation_pipeline,
)
from app.core.config import Settings, get_settings
from app.main import app
from app.recommendation.pipeline import RecommendationResult

client = TestClient(app)


def jpeg_bytes() -> bytes:
    output = io.BytesIO()
    Image.new("RGB", (8, 8), "green").save(output, format="JPEG")
    return output.getvalue()


class FakePipeline:
    index_version = "c" * 64

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def recommend(self, **kwargs: Any) -> list[RecommendationResult]:
        self.calls.append(kwargs)
        return [
            RecommendationResult(
                product_id=12,
                rank=1,
                score=0.9,
                retrieval_score=0.8,
                compatibility_score=0.95,
                reason="캐주얼 무드가 이어집니다.",
                product={
                    "product_id": 12,
                    "source": "MUSINSA",
                    "external_id": "3000012",
                    "name": "테스트 반팔",
                    "brand": "테스트 브랜드",
                    "price": 39_000,
                    "currency": "KRW",
                    "category": "TOP",
                    "subcategory": "SHORT_SLEEVE",
                    "image_url": "https://images.internal/12.jpg",
                    "purchase_url": "https://shop.example/12",
                },
            )
        ]


@pytest.fixture
def demo_pipeline() -> Iterator[FakePipeline]:
    pipeline = FakePipeline()
    app.dependency_overrides[require_recommendation_demo] = lambda: None
    app.dependency_overrides[
        require_recommendation_pipeline
    ] = lambda: pipeline
    yield pipeline
    app.dependency_overrides.clear()


def test_demo_page_is_served_by_fastapi(
    demo_pipeline: FakePipeline,
) -> None:
    response = client.get("/demo/recommendations")

    assert response.status_code == 200
    assert "추천 파이프라인 데모" in response.text
    assert "/api/v1/demo/recommendations" in response.text


def test_demo_upload_runs_same_recommendation_pipeline(
    demo_pipeline: FakePipeline,
) -> None:
    response = client.post(
        "/api/v1/demo/recommendations",
        data={
            "text": "여름 캐주얼 반팔",
            "gender": "MALE",
            "category": "TOP",
            "budget_min": "0",
            "budget_max": "100000",
            "candidate_limit": "50",
            "result_limit": "10",
        },
        files={
            "image": (
                "query.jpg",
                jpeg_bytes(),
                "image/jpeg",
            )
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "schemaVersion": "1.0",
        "indexVersion": "c" * 64,
        "candidateLimit": 50,
        "results": [
            {
                "productId": 12,
                "rank": 1,
                "score": 0.9,
                "retrievalScore": 0.8,
                "compatibilityScore": 0.95,
                "reason": "캐주얼 무드가 이어집니다.",
                "name": "테스트 반팔",
                "brand": "테스트 브랜드",
                "price": 39_000,
                "currency": "KRW",
                "category": "TOP",
                "subcategory": "SHORT_SLEEVE",
                "imageUrl": "https://images.internal/12.jpg",
                "purchaseUrl": "https://shop.example/12",
            }
        ],
    }
    assert demo_pipeline.calls[0]["text"] == "여름 캐주얼 반팔"
    assert demo_pipeline.calls[0]["mime_type"] == "image/jpeg"
    assert demo_pipeline.calls[0]["candidate_limit"] == 50


def test_demo_rejects_non_image_upload(
    demo_pipeline: FakePipeline,
) -> None:
    response = client.post(
        "/api/v1/demo/recommendations",
        data={"gender": "MALE"},
        files={"image": ("query.txt", b"not an image", "text/plain")},
    )

    assert response.status_code == 400
    assert demo_pipeline.calls == []


def test_demo_local_catalog_image_route(
    tmp_path: Path,
    demo_pipeline: FakePipeline,
) -> None:
    image_dir = tmp_path / "images" / "musinsa" / "3000012"
    image_dir.mkdir(parents=True)
    image_path = image_dir / "primary.jpg"
    image_path.write_bytes(jpeg_bytes())
    settings = Settings(
        enable_recommendation_demo=True,
        recommendation_demo_dataset_root=tmp_path,
    )
    app.dependency_overrides[get_settings] = lambda: settings

    response = client.get(
        "/demo/catalog-images/musinsa/3000012"
    )

    assert response.status_code == 200
    assert response.content == image_path.read_bytes()


def test_demo_is_hidden_when_disabled() -> None:
    settings = Settings(enable_recommendation_demo=False)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        response = client.get("/demo/recommendations")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
