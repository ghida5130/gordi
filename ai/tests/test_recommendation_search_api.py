from __future__ import annotations

import io
from collections.abc import Iterator
from typing import Any

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image

from app.api.dependencies import require_recommendation_pipeline
from app.api.routes.internal_recommendations import get_query_image_fetcher
from app.main import app
from app.recommendation.catalog_embeddings import ResolvedImage
from app.recommendation.image_fetcher import (
    QueryImageError,
    QueryImageFetcher,
)
from app.recommendation.pipeline import RecommendationResult
from app.services.recommendation_pipeline import RecommendationRuntimeError

client = TestClient(app)


def jpeg_bytes() -> bytes:
    output = io.BytesIO()
    Image.new("RGB", (8, 8), "blue").save(output, format="JPEG")
    return output.getvalue()


class FakePipeline:
    index_version = "a" * 64

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def recommend(self, **kwargs: Any) -> list[RecommendationResult]:
        self.calls.append(kwargs)
        return [
            RecommendationResult(
                product_id=7,
                rank=1,
                score=0.91234567,
                retrieval_score=0.92345678,
                compatibility_score=0.89123456,
                reason="여름 캐주얼 조건과 맞습니다.",
                product={"product_id": 7},
            )
        ]


class FakeImageFetcher:
    def __init__(self) -> None:
        self.urls: list[str] = []
        self.closed = False

    def fetch(self, url: str) -> ResolvedImage:
        self.urls.append(url)
        return ResolvedImage(
            content=b"image",
            mime_type="image/jpeg",
            sha256="b" * 64,
        )

    def close(self) -> None:
        self.closed = True


@pytest.fixture
def search_dependencies() -> Iterator[
    tuple[FakePipeline, FakeImageFetcher]
]:
    pipeline = FakePipeline()
    image_fetcher = FakeImageFetcher()
    app.dependency_overrides[
        require_recommendation_pipeline
    ] = lambda: pipeline
    app.dependency_overrides[get_query_image_fetcher] = lambda: image_fetcher
    yield pipeline, image_fetcher
    app.dependency_overrides.clear()


def valid_payload() -> dict[str, Any]:
    return {
        "recommendationId": 99,
        "text": "여름 캐주얼 상의",
        "imageUrl": "http://gordi-nginx/avatar.jpg",
        "gender": "MALE",
        "category": "TOP",
        "budgetMin": 10_000,
        "budgetMax": 100_000,
    }


def test_search_endpoint_runs_multimodal_pipeline(
    search_dependencies: tuple[FakePipeline, FakeImageFetcher],
) -> None:
    pipeline, image_fetcher = search_dependencies

    response = client.post(
        "/internal/v1/recommendations/search",
        json=valid_payload(),
    )

    assert response.status_code == 200
    assert response.json() == {
        "schemaVersion": "1.0",
        "recommendationId": 99,
        "indexVersion": "a" * 64,
        "results": [
            {
                "productId": 7,
                "rank": 1,
                "score": 0.912346,
                "retrievalScore": 0.923457,
                "compatibilityScore": 0.891235,
                "reason": "여름 캐주얼 조건과 맞습니다.",
            }
        ],
    }
    assert image_fetcher.urls == [
        "http://gordi-nginx/avatar.jpg"
    ]
    assert image_fetcher.closed
    assert pipeline.calls[0]["image"] == b"image"
    assert pipeline.calls[0]["candidate_limit"] == 50
    assert pipeline.calls[0]["result_limit"] == 10


@pytest.mark.parametrize(
    "changes",
    [
        {"text": None, "imageUrl": None},
        {"budgetMin": 100_001, "budgetMax": 100_000},
        {"candidateLimit": 5, "resultLimit": 10},
    ],
)
def test_search_endpoint_rejects_invalid_contract(
    search_dependencies: tuple[FakePipeline, FakeImageFetcher],
    changes: dict[str, Any],
) -> None:
    payload = valid_payload()
    payload.update(changes)

    response = client.post(
        "/internal/v1/recommendations/search",
        json=payload,
    )

    assert response.status_code == 422


def test_image_fetcher_accepts_allowed_jpeg() -> None:
    image = jpeg_bytes()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "image/jpeg"},
            content=image,
            request=request,
        )

    http_client = httpx.Client(
        transport=httpx.MockTransport(handler)
    )
    fetcher = QueryImageFetcher.create(
        ["images.internal"],
        client=http_client,
    )

    resolved = fetcher.fetch("https://images.internal/avatar.jpg")

    assert resolved.content == image
    assert resolved.mime_type == "image/jpeg"


def test_image_fetcher_rejects_redirect_to_disallowed_host() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            302,
            headers={"location": "http://169.254.169.254/latest"},
            request=request,
        )

    http_client = httpx.Client(
        transport=httpx.MockTransport(handler)
    )
    fetcher = QueryImageFetcher.create(
        ["images.internal"],
        client=http_client,
    )

    with pytest.raises(QueryImageError, match="not allowed"):
        fetcher.fetch("https://images.internal/avatar.jpg")


def test_image_fetcher_rejects_disallowed_host_before_request() -> None:
    requested = False

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal requested
        requested = True
        return httpx.Response(200, request=request)

    http_client = httpx.Client(
        transport=httpx.MockTransport(handler)
    )
    fetcher = QueryImageFetcher.create(
        ["images.internal"],
        client=http_client,
    )

    with pytest.raises(QueryImageError, match="not allowed"):
        fetcher.fetch("http://localhost/private.jpg")

    assert not requested


def test_runtime_dependency_maps_unavailable_pipeline_to_503(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def unavailable() -> None:
        raise RecommendationRuntimeError("index unavailable")

    monkeypatch.setattr(
        "app.api.dependencies.get_recommendation_pipeline",
        unavailable,
    )

    with pytest.raises(HTTPException) as captured:
        require_recommendation_pipeline()

    assert captured.value.status_code == 503
