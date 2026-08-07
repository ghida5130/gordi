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
        max_tokens: int | None = None,
        reasoning_effort: str | None = None,
    ) -> dict[str, Any]:
        self.requests.append(
            {
                "system": system,
                "user_parts": user_parts,
                "max_tokens": max_tokens,
                "reasoning_effort": reasoning_effort,
            }
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
    client = RecordingVLMClient({"compatibility": 0.9})
    fetcher = StaticFetcher()
    model = VLMPairwiseCompatibilityModel(
        client,
        product_image_fetcher=fetcher,
        reasoning_effort="low",
    )
    intent = parse_recommendation_intent("블랙 미니멀 코디")

    judgment = model.score_pair(
        intent=intent,
        query_image=b"query-image",
        query_mime_type="image/jpeg",
        product=product(1, name="블랙 슬랙스", description="포멀"),
    )

    assert judgment == PairwiseJudgment(0.9)
    assert client.requests[0]["max_tokens"] == 256
    assert client.requests[0]["reasoning_effort"] == "low"
    assert fetcher.urls == ["https://images.internal/1.jpg"]
    parts = client.requests[0]["user_parts"]
    kinds = [part["type"] for part in parts]
    assert kinds.count("image_url") == 2
    texts = " ".join(
        part["text"] for part in parts if part["type"] == "text"
    )
    assert "블랙 미니멀 코디" in texts
    assert "블랙 슬랙스" in texts


def test_resolve_product_image_url_rules() -> None:
    from app.recommendation.vlm_reranker import (
        resolve_product_image_url,
    )

    base = "https://cdn.example.net"
    # 절대 S3 URL → 키만 추출해 base 와 조합
    assert resolve_product_image_url(
        "https://bucket.s3.amazonaws.com/garments/musinsa/1/p.jpg",
        base,
    ) == "https://cdn.example.net/garments/musinsa/1/p.jpg"
    # 객체 키 → base 와 조합
    assert resolve_product_image_url(
        "garments/musinsa/1/p.jpg",
        base,
    ) == "https://cdn.example.net/garments/musinsa/1/p.jpg"
    # base 미설정 → 저장 값 그대로
    assert resolve_product_image_url(
        "http://gordi-nginx/garments/1.jpg",
        None,
    ) == "http://gordi-nginx/garments/1.jpg"


def test_score_pair_fetches_candidate_image_via_base_url() -> None:
    client = RecordingVLMClient({"compatibility": 0.9})
    fetcher = StaticFetcher()
    model = VLMPairwiseCompatibilityModel(
        client,
        product_image_fetcher=fetcher,
        image_base_url="https://cdn.example.net",
    )
    intent = parse_recommendation_intent("캐주얼 코디")

    model.score_pair(
        intent=intent,
        query_image=None,
        query_mime_type=None,
        product=product(1, name="캐주얼 반팔", description="데일리"),
    )

    assert fetcher.urls == ["https://cdn.example.net/1.jpg"]


def test_score_pair_omits_reasoning_effort_by_default() -> None:
    client = RecordingVLMClient({"compatibility": 0.5})
    model = VLMPairwiseCompatibilityModel(client)

    model.score_pair(
        intent=parse_recommendation_intent("캐주얼"),
        query_image=None,
        query_mime_type=None,
        product=product(1, name="니트", description="가을"),
    )

    assert client.requests[0]["reasoning_effort"] is None


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

    assert sorted(reranker.judged) == [1, 2, 3]
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

    assert sorted(reranker.judged) == [1, 2]
    assert [result.product_id for result in results] == [1, 2, 3]


def test_pipeline_rerank_deadline_keeps_rule_scores() -> None:
    # 마감시간 초과 판정은 규칙 점수 유지 — /search 경로도 /rank 와
    # 동일하게 리랭크 지연이 마감시간으로 상한된다.
    import time

    class HangingReranker(StaticReranker):
        def score_pair(self, **kwargs):
            time.sleep(1.5)
            return super().score_pair(**kwargs)

    reranker = HangingReranker({1: 0.0, 2: 1.0})
    pipeline = RecommendationPipeline(
        Retriever(hits(3)),
        pairwise_reranker=reranker,
        rerank_top_k=2,
        rerank_deadline_seconds=0.2,
    )

    started = time.monotonic()
    results = pipeline.recommend(
        text="기본 상의",
        image=None,
        mime_type=None,
        filters=SearchFilters(gender="MALE"),
        result_limit=3,
    )
    elapsed = time.monotonic() - started

    assert [result.product_id for result in results] == [1, 2, 3]
    assert elapsed < 1.2


def test_pipeline_reports_progress_stages_in_order() -> None:
    reranker = StaticReranker({1: 0.9, 2: 0.8})
    pipeline = RecommendationPipeline(
        Retriever(hits(3)),
        pairwise_reranker=reranker,
        rerank_top_k=2,
    )
    events: list[tuple[str, dict]] = []

    pipeline.recommend(
        text="기본 상의",
        image=None,
        mime_type=None,
        filters=SearchFilters(gender="MALE"),
        result_limit=3,
        progress=lambda stage, detail: events.append((stage, detail)),
    )

    stages = [
        (stage, detail.get("status")) for stage, detail in events
    ]
    assert stages == [
        ("image_attributes", "skipped"),
        ("retrieval", "start"),
        ("retrieval", "done"),
        ("scoring", "done"),
        ("rerank", "start"),
        ("rerank", "progress"),
        ("rerank", "progress"),
        ("rerank", "done"),
        ("reasons", "start"),
        ("reasons", "done"),
    ]
    rerank_progress = [
        detail
        for stage, detail in events
        if stage == "rerank" and detail.get("status") == "progress"
    ]
    assert [item["current"] for item in rerank_progress] == [1, 2]
    assert all(item["total"] == 2 for item in rerank_progress)


def test_pipeline_progress_callback_errors_do_not_break_results() -> None:
    pipeline = RecommendationPipeline(Retriever(hits(2)))

    def broken(stage: str, detail: dict) -> None:
        raise RuntimeError("observer down")

    results = pipeline.recommend(
        text="기본 상의",
        image=None,
        mime_type=None,
        filters=SearchFilters(gender="MALE"),
        result_limit=2,
        progress=broken,
    )

    assert len(results) == 2


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


def test_pipeline_rejects_invalid_rerank_concurrency() -> None:
    with pytest.raises(
        RecommendationPipelineError,
        match="rerank_concurrency",
    ):
        RecommendationPipeline(
            Retriever([]),
            pairwise_reranker=StaticReranker({}),
            rerank_concurrency=0,
        )


class BarrierReranker:
    """Succeeds only when two judgments overlap in time."""

    def __init__(self) -> None:
        import threading

        self.barrier = threading.Barrier(2, timeout=5)

    def score_pair(
        self,
        *,
        intent: Any,
        query_image: bytes | None,
        query_mime_type: str | None,
        product: dict[str, Any],
    ) -> PairwiseJudgment:
        self.barrier.wait()
        return PairwiseJudgment(0.9)


def test_pipeline_judges_candidates_concurrently() -> None:
    pipeline = RecommendationPipeline(
        Retriever(hits(2)),
        pairwise_reranker=BarrierReranker(),
        rerank_top_k=2,
        rerank_concurrency=2,
    )

    results = pipeline.recommend(
        text="기본 상의",
        image=None,
        mime_type=None,
        filters=SearchFilters(gender="MALE"),
        result_limit=2,
    )

    # A sequential run would trip the barrier timeout and fall back to
    # rule-based scores; concurrent execution yields the VLM score.
    assert all(
        result.compatibility_score == pytest.approx(0.9)
        for result in results
    )
