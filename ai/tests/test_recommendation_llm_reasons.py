from __future__ import annotations

import json
from typing import Any

import pytest

from app.recommendation.llm_reasons import (
    LLMGroundedReasonGenerator,
    MAX_REASON_LENGTH,
)
from app.recommendation.pipeline import (
    RecommendationPipeline,
    RuleBasedCompatibilityModel,
    parse_recommendation_intent,
)
from app.recommendation.vector_index import SearchFilters, SearchHit
from app.recommendation.vlm import VLMError
from tests.test_recommendation_pipeline import Retriever, product


class StaticLLMClient:
    def __init__(self, answer: str) -> None:
        self.answer = answer
        self.requests: list[dict[str, Any]] = []

    def complete_text(
        self,
        *,
        system: str,
        user_parts: list[dict[str, Any]],
    ) -> str:
        self.requests.append(
            {"system": system, "user_parts": user_parts}
        )
        return self.answer


class FailingLLMClient:
    def complete_text(
        self,
        *,
        system: str,
        user_parts: list[dict[str, Any]],
    ) -> str:
        raise VLMError("unavailable")


def scored_inputs() -> dict[str, Any]:
    intent = parse_recommendation_intent("여름 블랙 캐주얼")
    item = product(
        1,
        name="블랙 캐주얼 반팔",
        description="여름 데일리 의류",
    )
    compatibility = RuleBasedCompatibilityModel().score(intent, item)
    return {
        "intent": intent,
        "product": item,
        "retrieval_score": 0.85,
        "compatibility": compatibility,
        "filters": SearchFilters(gender="MALE", budget_max=100_000),
    }


def test_llm_reason_passes_grounded_answer_through() -> None:
    client = StaticLLMClient(
        "요청하신 블랙 톤과 여름 캐주얼 무드에 맞는 상품입니다."
    )
    generator = LLMGroundedReasonGenerator(client)

    reason = generator.generate(**scored_inputs())

    assert reason == (
        "요청하신 블랙 톤과 여름 캐주얼 무드에 맞는 상품입니다."
    )
    facts = json.loads(
        client.requests[0]["user_parts"][0]["text"]
    )
    assert facts["상품"]["이름"] == "블랙 캐주얼 반팔"
    assert facts["사용자_조건과_일치"]["색상"] == ["블랙"]
    assert facts["예산_범위_안"] is True


def test_llm_reason_rejects_unverified_tag_mentions() -> None:
    client = StaticLLMClient(
        "화이트 컬러와 겨울 포멀 무드에 완벽한 상품입니다."
    )
    generator = LLMGroundedReasonGenerator(client)

    reason = generator.generate(**scored_inputs())

    assert "화이트" not in reason
    assert "블랙" in reason


@pytest.mark.parametrize(
    "answer",
    ["", "   ", "긴 문장 " * MAX_REASON_LENGTH],
)
def test_llm_reason_rejects_empty_or_oversized_answers(
    answer: str,
) -> None:
    generator = LLMGroundedReasonGenerator(StaticLLMClient(answer))

    reason = generator.generate(**scored_inputs())

    assert "블랙" in reason


def test_llm_reason_falls_back_when_client_fails() -> None:
    generator = LLMGroundedReasonGenerator(FailingLLMClient())

    reason = generator.generate(**scored_inputs())

    assert "블랙" in reason
    assert "여름" in reason


def test_pipeline_uses_llm_reason_generator() -> None:
    hit = SearchHit(
        product_id=1,
        score=0.8,
        product=product(
            1,
            name="블랙 캐주얼 반팔",
            description="여름 데일리 의류",
        ),
    )
    client = StaticLLMClient("블랙 무드에 어울리는 선택입니다.")
    pipeline = RecommendationPipeline(
        Retriever([hit]),
        reason_generator=LLMGroundedReasonGenerator(client),
    )

    results = pipeline.recommend(
        text="여름 블랙 캐주얼",
        image=None,
        mime_type=None,
        filters=SearchFilters(gender="MALE"),
    )

    assert results[0].reason == "블랙 무드에 어울리는 선택입니다."
    assert len(client.requests) == 1
