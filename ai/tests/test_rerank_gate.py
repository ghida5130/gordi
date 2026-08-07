from __future__ import annotations

from pathlib import Path

import pytest

from app.recommendation.pipeline import (
    RecommendationPipeline,
    RecommendationPipelineError,
    should_skip_vlm_rerank,
)
from app.recommendation.vector_index import (
    SearchFilters,
    SearchHit,
)
from app.recommendation.vlm_reranker import PairwiseJudgment
from app.services.vector_ranker import VectorRecommendationRanker
from tests.test_recommendation_pipeline import (
    Retriever,
    product as pipeline_product,
)
from tests.test_vector_index import (
    QueryProvider,
    build_index,
    product,
    vector,
)
from tests.test_vector_ranker import candidate, condition


class CountingReranker:
    def __init__(self) -> None:
        self.calls = 0

    def score_pair(self, **_kwargs) -> PairwiseJudgment:
        self.calls += 1
        return PairwiseJudgment(compatibility=0.9)


def hits() -> list[SearchHit]:
    return [
        SearchHit(
            product_id=index,
            score=0.9 - index * 0.01,
            product=pipeline_product(
                index,
                name=f"테스트 상의 {index}",
                description="데모용",
            ),
        )
        for index in range(1, 4)
    ]


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("면접에 입고 갈 단정한 셔츠", True),
        ("결혼식 하객 하의", True),
        ("매일 등교할 때 입을 옷", True),
        ("루프탑 데이트, 은은하게 화려하게", False),
        ("주말 한강 피크닉", False),
        (None, False),
        ("", False),
    ],
)
def test_should_skip_vlm_rerank_keywords(
    text: str | None,
    expected: bool,
) -> None:
    assert should_skip_vlm_rerank(text, has_image=False) is expected


def test_image_query_bypasses_gate() -> None:
    # 이미지 입력은 심미 맥락 신호 — 스킵 키워드가 있어도 리랭크.
    assert (
        should_skip_vlm_rerank("면접 셔츠", has_image=True) is False
    )


def make_pipeline(
    reranker: CountingReranker,
    mode: str,
) -> RecommendationPipeline:
    return RecommendationPipeline(
        Retriever(hits()),
        pairwise_reranker=reranker,
        rerank_mode=mode,
        index_version="a" * 64,
    )


def run(pipeline: RecommendationPipeline, text: str) -> None:
    pipeline.recommend(
        text=text,
        image=None,
        mime_type=None,
        filters=SearchFilters(gender="MALE"),
    )


def test_pipeline_selective_mode_skips_gated_query() -> None:
    reranker = CountingReranker()
    pipeline = make_pipeline(reranker, "selective")

    run(pipeline, "면접에 입고 갈 셔츠")
    assert reranker.calls == 0

    run(pipeline, "루프탑 데이트 상의")
    assert reranker.calls > 0


def test_pipeline_always_mode_ignores_gate() -> None:
    reranker = CountingReranker()
    pipeline = make_pipeline(reranker, "always")

    run(pipeline, "면접에 입고 갈 셔츠")

    assert reranker.calls > 0


def test_pipeline_rejects_unknown_mode() -> None:
    with pytest.raises(
        RecommendationPipelineError, match="rerank_mode"
    ):
        make_pipeline(CountingReranker(), "sometimes")


def test_vector_ranker_selective_mode_gates_tpo(
    tmp_path: Path,
) -> None:
    products = [product(1), product(2), product(3)]
    vectors = {
        1: vector(1.0, 0.0),
        2: vector(0.7, 0.7),
        3: vector(0.0, 1.0),
    }
    _, index = build_index(tmp_path, products, vectors)
    reranker = CountingReranker()
    ranker = VectorRecommendationRanker(
        index,
        QueryProvider(vector(1.0, 0.0)),
        reranker=reranker,
        rerank_mode="selective",
    )

    ranker.rank(
        condition(tpo="다음 주 면접이라 단정하게"),
        [candidate(1)],
        limit=1,
    )
    assert reranker.calls == 0

    ranker.rank(
        condition(tpo="금요일 저녁 루프탑 데이트"),
        [candidate(1)],
        limit=1,
    )
    assert reranker.calls == 1
