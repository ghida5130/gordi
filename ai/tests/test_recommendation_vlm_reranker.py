from __future__ import annotations

from typing import Any

import pytest

from app.recommendation.catalog_embeddings import ResolvedImage
from app.recommendation.pipeline import (
    MAX_RERANK_TOP_K,
    RecommendationPipeline,
    RecommendationPipelineError,
    parse_recommendation_intent,
)
from app.recommendation.vector_index import SearchFilters, SearchHit
from app.recommendation.vlm import VLMError
from app.recommendation.vlm_reranker import (
    PairwiseJudgment,
    VLMPairwiseCompatibilityModel,
)
from tests.test_recommendation_pipeline import Retriever, product


class RecordingVLMClient:
    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload
        self.requests: list[dict[str, Any]] = []

    def complete_json(
        self,
        *,
        system: str,
        user_parts: list[dict[str, Any]],
    ) -> dict[str, Any]:
        self.requests.append(
            {"system": system, "user_parts": user_parts}
        )
        return self.payload


class FailingFetcher:
    def fetch(self, url: str) -> ResolvedImage:
        raise RuntimeError("host not allowed")


class StaticFetcher:
    def __init__(self) -> None:
        self.urls: list[str] = []

    def fetch(self, url: str) -> ResolvedImage:
        self.urls.append(url)
        return ResolvedImage(
            content=b"candidate-image",
            mime_type="image/jpeg",
            sha256="0" * 64,
        )


def test_score_pair_sends_query_and_candidate_evidence() -> None:
    client = RecordingVLMClient(
        {"compatibility": 0.9, "rationale": "색이 잘 어울립니다"}
    )
    fetcher = StaticFetcher()
    model = VLMPairwiseCompatibilityModel(
        client,
        product_image_fetcher=fetcher,
    )
    intent = parse_recommendation_intent("블랙 미니멀 코디")

    judgment = model.score_pair(
        intent=intent,
        query_image=b"query-image",
        query_mime_type="image/jpeg",
        product=product(1, name="블랙 슬랙스", description="포멀"),
    )

    assert judgment == PairwiseJudgment(0.9, "색이 잘 어울립니다")
    assert fetcher.urls == ["https://images.internal/1.jpg"]
    parts = client.requests[0]["user_parts"]
    kinds = [part["type"] for part in parts]
    assert kinds.count("image_url") == 2
    texts = " ".join(
        part["text"] for part in parts if part["type"] == "text"
    )
    assert "블랙 미니멀 코디" in texts
    assert "블랙 슬랙스" in texts


def test_score_pair_degrades_to_metadata_when_image_fetch_fails() -> None:
    client = RecordingVLMClient({"compatibility": 0.4})
    model = VLMPairwiseCompatibilityModel(
        client,
        product_image_fetcher=FailingFetcher(),
    )

    judgment = model.score_pair(
        intent=parse_recommendation_intent("캐주얼"),
        query_image=None,
        query_mime_type=None,
        product=product(1, name="니트", description="가을"),
    )

    assert judgment.compatibility == pytest.approx(0.4)
    assert judgment.rationale is None
    kinds = [
        part["type"]
        for part in client.requests[0]["user_parts"]
    ]
    assert "image_url" not in kinds


@pytest.mark.parametrize(
    "payload",
    [
        {"compatibility": "high"},
        {"compatibility": True},
        {"compatibility": 1.5},
        {"rationale": "no score"},
    ],
)
def test_score_pair_rejects_invalid_judgments(
    payload: dict[str, Any],
) -> None:
    model = VLMPairwiseCompatibilityModel(
        RecordingVLMClient(payload)
    )

    with pytest.raises(VLMError):
        model.score_pair(
            intent=parse_recommendation_intent("캐주얼"),
            query_image=None,
            query_mime_type=None,
            product=product(1, name="니트", description="가을"),
        )


class StaticReranker:
    def __init__(self, scores: dict[int, float]) -> None:
        self.scores = scores
        self.judged: list[int] = []

    def score_pair(
        self,
        *,
        intent: Any,
        query_image: bytes | None,
        query_mime_type: str | None,
        product: dict[str, Any],
    ) -> PairwiseJudgment:
        product_id = int(product["product_id"])
        self.judged.append(product_id)
        if product_id not in self.scores:
            raise VLMError("no judgment")
        return PairwiseJudgment(self.scores[product_id], None)


def hits(count: int) -> list[SearchHit]:
    return [
        SearchHit(
            product_id=product_id,
            score=0.9 - product_id * 0.01,
            product=product(
                product_id,
                name=f"기본 상의 {product_id}",
                description="기본",
            ),
        )
        for product_id in range(1, count + 1)
    ]


def test_pipeline_reranks_only_top_k_and_reorders() -> None:
    reranker = StaticReranker({1: 0.0, 2: 1.0, 3: 0.5})
    pipeline = RecommendationPipeline(
        Retriever(hits(5)),
        pairwise_reranker=reranker,
        rerank_top_k=3,
    )

    results = pipeline.recommend(
        text="기본 상의",
        image=None,
        mime_type=None,
        filters=SearchFilters(gender="MALE"),
        result_limit=5,
    )

    assert reranker.judged == [1, 2, 3]
    assert results[0].product_id == 2
    assert results[0].compatibility_score == pytest.approx(1.0)
    ranked_ids = [result.product_id for result in results]
    assert ranked_ids.index(2) < ranked_ids.index(1)


def test_pipeline_keeps_rule_score_when_judgment_fails() -> None:
    reranker = StaticReranker({})
    pipeline = RecommendationPipeline(
        Retriever(hits(3)),
        pairwise_reranker=reranker,
        rerank_top_k=2,
    )

    results = pipeline.recommend(
        text="기본 상의",
        image=None,
        mime_type=None,
        filters=SearchFilters(gender="MALE"),
        result_limit=3,
    )

    assert reranker.judged == [1, 2]
    assert [result.product_id for result in results] == [1, 2, 3]


def test_pipeline_rejects_invalid_rerank_top_k() -> None:
    with pytest.raises(
        RecommendationPipelineError,
        match="rerank_top_k",
    ):
        RecommendationPipeline(
            Retriever([]),
            pairwise_reranker=StaticReranker({}),
            rerank_top_k=MAX_RERANK_TOP_K + 1,
        )
