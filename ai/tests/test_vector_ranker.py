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


class ScriptedReranker:
    """Deterministic PairwiseCompatibilityModel double."""

    def __init__(self, scores: dict[int, float]) -> None:
        self.scores = scores
        self.judged: list[dict] = []

    def score_pair(self, *, intent, query_image, query_mime_type, product):
        from app.recommendation.vlm_reranker import PairwiseJudgment

        self.judged.append(product)
        product_id = int(product["product_id"])
        if product_id not in self.scores:
            raise RuntimeError("vlm judgment failed")
        return PairwiseJudgment(compatibility=self.scores[product_id])


def make_reranked_ranker(
    tmp_path: Path,
    reranker: ScriptedReranker,
    **kwargs,
) -> VectorRecommendationRanker:
    products = [product(1), product(2), product(3)]
    vectors = {
        1: vector(1.0, 0.0),
        2: vector(0.7, 0.7),
        3: vector(0.0, 1.0),
    }
    _, index = build_index(tmp_path, products, vectors)
    return VectorRecommendationRanker(
        index,
        QueryProvider(vector(1.0, 0.0)),
        reranker=reranker,
        **kwargs,
    )


def test_vlm_rerank_overrides_rule_compatibility(tmp_path: Path) -> None:
    # 벡터 순서는 1 > 2 > 3 이지만 VLM 이 3 을 최고 궁합으로 판정한다.
    reranker = ScriptedReranker({1: 0.0, 2: 0.1, 3: 1.0})
    ranker = make_reranked_ranker(tmp_path, reranker)

    ranked = ranker.rank(
        condition(),
        [candidate(1), candidate(2), candidate(3)],
        limit=3,
    )

    assert [item.product_id for item in ranked] == [3, 1, 2]
    # 판정에는 인덱스 스냅샷 메타데이터(이미지 URL 포함)가 전달된다.
    assert all("image_url" in judged for judged in reranker.judged)


def test_vlm_rerank_failure_keeps_vector_order(tmp_path: Path) -> None:
    reranker = ScriptedReranker({})  # 모든 판정 실패
    ranker = make_reranked_ranker(tmp_path, reranker)

    ranked = ranker.rank(
        condition(),
        [candidate(1), candidate(2), candidate(3)],
        limit=3,
    )

    assert [item.product_id for item in ranked] == [1, 2, 3]
    assert len(reranker.judged) == 3


def test_vlm_rerank_judges_only_top_k(tmp_path: Path) -> None:
    reranker = ScriptedReranker({1: 0.5, 2: 0.5, 3: 0.5})
    ranker = make_reranked_ranker(tmp_path, reranker, rerank_top_k=2)

    ranker.rank(
        condition(),
        [candidate(1), candidate(2), candidate(3)],
        limit=3,
    )

    judged_ids = {int(item["product_id"]) for item in reranker.judged}
    assert judged_ids == {1, 2}


def test_vlm_rerank_deadline_keeps_rule_scores(tmp_path: Path) -> None:
    # 판정이 keepalive filler 로 매달리는 상황(212초 행 사건) —
    # 마감시간이 웨이브를 끊고 규칙 점수를 유지해야 한다.
    import time

    class HangingReranker(ScriptedReranker):
        def score_pair(self, **kwargs):
            time.sleep(1.5)
            return super().score_pair(**kwargs)

    # 판정이 반영됐다면 3 이 1 위가 됐을 점수 — 반영되면 안 된다.
    reranker = HangingReranker({1: 0.0, 2: 0.1, 3: 1.0})
    ranker = make_reranked_ranker(
        tmp_path,
        reranker,
        rerank_deadline_seconds=0.2,
    )

    started = time.monotonic()
    ranked = ranker.rank(
        condition(),
        [candidate(1), candidate(2), candidate(3)],
        limit=3,
    )
    elapsed = time.monotonic() - started

    assert [item.product_id for item in ranked] == [1, 2, 3]
    assert elapsed < 1.2


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


def test_tpo_text_flows_into_embedding_query(
    tmp_path: Path,
) -> None:
    provider = QueryProvider(vector(1.0, 0.0))
    products = [product(1), product(2), product(3)]
    vectors = {1: vector(1.0, 0.0), 2: vector(0.7, 0.7), 3: vector(0.0, 1.0)}
    _, index = build_index(tmp_path, products, vectors)
    ranker = VectorRecommendationRanker(index, provider)

    ranker.rank(
        condition(tpo="  여름 결혼식 하객으로 참석해요  "),
        [candidate(1)],
        limit=1,
    )
    ranker.rank(condition(tpo=""), [candidate(1)], limit=1)

    with_tpo = provider.calls[0]["text"]
    without_tpo = provider.calls[1]["text"]
    assert "상황: 여름 결혼식 하객으로 참석해요" in with_tpo
    assert "캐주얼" in with_tpo
    assert "상황:" not in without_tpo


def test_rank_endpoint_accepts_tpo_field(tmp_path: Path) -> None:
    # Spring(b8bb526)은 미입력 시 tpo="" 를 보낸다 — 계약상 422 가
    # 나면 추천 생성·교체가 전부 실패하므로 빈 값·실값 모두 수용 확인.
    ranker = make_ranker(tmp_path, vector(1.0, 0.0))
    app.dependency_overrides[get_vector_ranker] = lambda: ranker
    try:
        for tpo in ("", "다음 주 면접이 있어 단정하게 입고 싶어요"):
            payload = rank_payload()
            payload["condition"]["tpo"] = tpo
            response = client.post(
                "/internal/v1/recommendations/rank",
                json=payload,
            )
            assert response.status_code == 200, response.text
    finally:
        app.dependency_overrides.clear()


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
