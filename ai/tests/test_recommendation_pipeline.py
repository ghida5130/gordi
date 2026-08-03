from __future__ import annotations

from typing import Any

import pytest

from app.recommendation.pipeline import (
    RecommendationPipeline,
    RecommendationPipelineError,
    infer_product_tags,
    parse_recommendation_intent,
)
from app.recommendation.vector_index import SearchFilters, SearchHit


def product(
    product_id: int,
    *,
    name: str,
    description: str,
    subcategory: str = "SHORT_SLEEVE",
    price: int = 50_000,
) -> dict[str, Any]:
    return {
        "product_id": product_id,
        "source": "MUSINSA",
        "external_id": str(3_000_000 + product_id),
        "name": name,
        "brand": "테스트",
        "gender": "MALE",
        "price": price,
        "category": "TOP",
        "subcategory": subcategory,
        "image_url": f"https://images.internal/{product_id}.jpg",
        "purchase_url": f"https://shop.example/{product_id}",
        "description": description,
        "currency": "KRW",
        "availability": "AVAILABLE",
    }


class Retriever:
    def __init__(self, hits: list[SearchHit]) -> None:
        self.hits = hits
        self.calls: list[dict[str, Any]] = []

    def retrieve(
        self,
        *,
        text: str | None,
        image: bytes | None,
        mime_type: str | None,
        filters: SearchFilters,
        limit: int = 50,
    ) -> list[SearchHit]:
        self.calls.append(
            {
                "text": text,
                "image": image,
                "mime_type": mime_type,
                "filters": filters,
                "limit": limit,
            }
        )
        return self.hits[:limit]


def test_intent_and_product_tags_use_observed_text_and_subcategory() -> None:
    intent = parse_recommendation_intent(
        "여름에 입을 블랙 캐주얼 코디"
    )
    tags = infer_product_tags(
        product(
            1,
            name="블랙 스포츠 반팔",
            description="여름용 스포티 상의",
            subcategory="SPORTS_TOP",
        )
    )

    assert intent.tags.colors == {"BLACK"}
    assert intent.tags.seasons == {"SUMMER"}
    assert intent.tags.styles == {"CASUAL"}
    assert tags.colors == {"BLACK"}
    assert tags.seasons == {"SUMMER"}
    assert tags.styles == {"SPORTY"}


def test_english_color_keyword_requires_word_boundaries() -> None:
    intent = parse_recommendation_intent(
        "preferred minimal top, not a color request"
    )

    assert intent.tags.colors == set()
    assert intent.tags.styles == {"MINIMAL"}


def test_pipeline_reranks_with_color_season_and_style_conditions() -> None:
    high_vector_mismatch = SearchHit(
        product_id=1,
        score=0.98,
        product=product(
            1,
            name="화이트 포멀 니트",
            description="겨울 오피스 의류",
            subcategory="KNIT",
        ),
    )
    lower_vector_match = SearchHit(
        product_id=2,
        score=0.70,
        product=product(
            2,
            name="블랙 캐주얼 반팔",
            description="여름 데일리 의류",
        ),
    )
    retriever = Retriever([high_vector_mismatch, lower_vector_match])
    pipeline = RecommendationPipeline(retriever)
    filters = SearchFilters(
        gender="MALE",
        category="TOP",
        budget_max=100_000,
    )

    results = pipeline.recommend(
        text="여름 블랙 캐주얼",
        image=None,
        mime_type=None,
        filters=filters,
    )

    assert [result.product_id for result in results] == [2, 1]
    assert results[0].rank == 1
    assert results[0].compatibility_score == pytest.approx(1.0)
    assert "블랙" in results[0].reason
    assert "여름" in results[0].reason
    assert "캐주얼" in results[0].reason
    assert retriever.calls[0]["limit"] == 50
    assert retriever.calls[0]["filters"] is filters


def test_pipeline_fallback_reason_does_not_invent_conditions() -> None:
    item = product(
        1,
        name="기본 상의",
        description="기본 의류",
        subcategory="OTHER_TOP",
    )
    pipeline = RecommendationPipeline(
        Retriever([SearchHit(product_id=1, score=0.8, product=item)])
    )

    results = pipeline.recommend(
        text="이 이미지와 어울리는 옷",
        image=b"jpeg",
        mime_type="image/jpeg",
        filters=SearchFilters(gender="MALE"),
    )

    assert "멀티모달 특징이 유사" in results[0].reason
    assert "블랙" not in results[0].reason
    assert "여름" not in results[0].reason


def test_pipeline_returns_top_ten_with_stable_product_id_ties() -> None:
    hits = [
        SearchHit(
            product_id=product_id,
            score=0.5,
            product=product(
                product_id,
                name=f"기본 상의 {product_id}",
                description="기본",
            ),
        )
        for product_id in range(12, 0, -1)
    ]
    pipeline = RecommendationPipeline(Retriever(hits))

    results = pipeline.recommend(
        text="기본 상의",
        image=None,
        mime_type=None,
        filters=SearchFilters(gender="MALE"),
    )

    assert len(results) == 10
    assert [result.product_id for result in results] == list(range(1, 11))
    assert [result.rank for result in results] == list(range(1, 11))


def test_pipeline_rejects_result_limit_larger_than_candidate_limit() -> None:
    pipeline = RecommendationPipeline(Retriever([]))

    with pytest.raises(
        RecommendationPipelineError,
        match="candidate_limit",
    ):
        pipeline.recommend(
            text="상의",
            image=None,
            mime_type=None,
            filters=SearchFilters(gender="MALE"),
            candidate_limit=5,
            result_limit=10,
        )
