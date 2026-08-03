from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.routes.internal_recommendations import get_vector_ranker
from app.main import app
from app.schemas.recommendation import RankCandidate, RankCondition
from app.services.vector_ranker import (
    VectorRankError,
    VectorRecommendationRanker,
)
from tests.test_vector_index import (
    QueryProvider,
    build_index,
    product,
    vector,
)

client = TestClient(app)


def condition(**overrides) -> RankCondition:
    base = {
        "gender": "MALE",
        "category": "TOP",
        "subcategory": None,
        "budget_min": 0,
        "budget_max": 100_000,
        "moods": ["CASUAL"],
    }
    base.update(overrides)
    return RankCondition(**base)


def candidate(product_id: int, **overrides) -> RankCandidate:
    base = {
        "product_id": product_id,
        "name": f"캐주얼 반팔 {product_id}",
        "brand": "테스트",
        "price": 50_000,
        "gender": "MALE",
        "category": "TOP",
        "subcategory": "SHORT_SLEEVE",
        "description": "데일리 캐주얼",
    }
    base.update(overrides)
    return RankCandidate(**base)


def make_ranker(
    tmp_path: Path,
    query: list[float],
) -> VectorRecommendationRanker:
    products = [product(1), product(2), product(3)]
    vectors = {
        1: vector(1.0, 0.0),
        2: vector(0.7, 0.7),
        3: vector(0.0, 1.0),
    }
    _, index = build_index(tmp_path, products, vectors)
    return VectorRecommendationRanker(index, QueryProvider(query))


def test_vector_ranker_orders_by_similarity(tmp_path: Path) -> None:
    ranker = make_ranker(tmp_path, vector(1.0, 0.0))

    ranked = ranker.rank(
        condition(),
        [candidate(1), candidate(2), candidate(3)],
        limit=3,
    )

    assert [item.product_id for item in ranked] == [1, 2, 3]
    assert ranked[0].rank == 1
    assert ranked[0].score > ranked[2].score


def test_vector_ranker_revalidates_contract_filters(
    tmp_path: Path,
) -> None:
    ranker = make_ranker(tmp_path, vector(1.0, 0.0))

    ranked = ranker.rank(
        condition(),
        [
            candidate(1, gender="FEMALE"),
            candidate(2, price=200_000),
            candidate(3),
        ],
        limit=3,
    )

    assert [item.product_id for item in ranked] == [3]


def test_vector_ranker_neutral_score_for_missing_vectors(
    tmp_path: Path,
) -> None:
    ranker = make_ranker(tmp_path, vector(1.0, 0.0))

    ranked = ranker.rank(
        condition(),
        [candidate(1), candidate(404)],
        limit=2,
    )

    assert [item.product_id for item in ranked] == [1, 404]


def test_vector_ranker_rejects_zero_index_coverage(
    tmp_path: Path,
) -> None:
    ranker = make_ranker(tmp_path, vector(1.0, 0.0))

    with pytest.raises(VectorRankError, match="snapshot"):
        ranker.rank(
            condition(),
            [candidate(404), candidate(405)],
            limit=2,
        )


def test_vector_ranker_embedding_failure_raises(tmp_path: Path) -> None:
    products = [product(1)]
    _, index = build_index(tmp_path, products, {1: vector(1.0, 0.0)})

    class FailingProvider(QueryProvider):
        def embed_query(self, **kwargs):
            from app.recommendation.catalog_embeddings import (
                CatalogEmbeddingError,
            )

            raise CatalogEmbeddingError("provider down")

    ranker = VectorRecommendationRanker(
        index,
        FailingProvider(vector(1.0, 0.0)),
    )

    with pytest.raises(VectorRankError, match="provider down"):
        ranker.rank(condition(), [candidate(1)], limit=1)


def rank_payload() -> dict:
    return {
        "recommendationId": 1,
        "condition": {
            "gender": "MALE",
            "category": "TOP",
            "budgetMin": 0,
            "budgetMax": 100_000,
            "moods": ["CASUAL"],
        },
        "limit": 2,
        "candidates": [
            {
                "productId": 1,
                "name": "캐주얼 반팔 1",
                "brand": "테스트",
                "price": 50_000,
                "gender": "MALE",
                "category": "TOP",
                "subcategory": "SHORT_SLEEVE",
                "description": "데일리",
            },
            {
                "productId": 2,
                "name": "포멀 셔츠 2",
                "brand": "테스트",
                "price": 60_000,
                "gender": "MALE",
                "category": "TOP",
                "subcategory": "SHIRT",
                "description": "오피스",
            },
        ],
    }


def test_rank_endpoint_uses_vector_ranker_when_available(
    tmp_path: Path,
) -> None:
    ranker = make_ranker(tmp_path, vector(1.0, 0.0))
    app.dependency_overrides[get_vector_ranker] = lambda: ranker
    try:
        response = client.post(
            "/internal/v1/recommendations/rank",
            json=rank_payload(),
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert [item["productId"] for item in body["ranked"]] == [1, 2]


def test_rank_endpoint_falls_back_to_baseline_on_vector_error(
    tmp_path: Path,
) -> None:
    ranker = make_ranker(tmp_path, vector(1.0, 0.0))

    class Exploding:
        def rank(self, **kwargs):
            raise VectorRankError("index generation mismatch")

    app.dependency_overrides[get_vector_ranker] = lambda: Exploding()
    try:
        response = client.post(
            "/internal/v1/recommendations/rank",
            json=rank_payload(),
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert len(body["ranked"]) == 2
