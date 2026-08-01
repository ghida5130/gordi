"""LLM-written recommendation reasons grounded in verified facts.

The generator hands the model a closed fact sheet (matched tags,
budget fit, product metadata, scores) and asks for one short Korean
reason. Output is checked against the tag vocabulary: if the model
mentions any color/season/style/pattern label that is not in the
verified facts, the answer is rejected as a hallucination and the
rule-based ``GroundedReasonGenerator`` fallback is used instead — the
same fallback that covers request failures, so enabling this feature
can never block recommendations.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Protocol

from app.recommendation.pipeline import (
    _COLOR_LABELS,
    _PATTERN_LABELS,
    _SEASON_LABELS,
    _STYLE_LABELS,
    CompatibilityScore,
    GroundedReasonGenerator,
    RecommendationIntent,
    infer_product_tags,
)
from app.recommendation.vector_index import SearchFilters
from app.recommendation.vlm import text_part

MAX_REASON_LENGTH = 200

_logger = logging.getLogger(__name__)

_ALL_TAG_LABELS: dict[str, str] = {
    **{label: f"color:{code}" for code, label in _COLOR_LABELS.items()},
    **{
        label: f"season:{code}"
        for code, label in _SEASON_LABELS.items()
    },
    **{label: f"style:{code}" for code, label in _STYLE_LABELS.items()},
    **{
        label: f"pattern:{code}"
        for code, label in _PATTERN_LABELS.items()
    },
}

_SYSTEM_PROMPT = (
    "You write one short recommendation reason in Korean (존댓말, "
    "1~2 문장, 200자 이내) for a fashion recommendation. Use ONLY the "
    "facts in the provided JSON. Never mention colors, seasons, "
    "styles, patterns, or qualities that are not listed there. No "
    "exaggeration, no invented details. Answer with the sentence "
    "only, no JSON and no quotes."
)


class LLMClient(Protocol):
    def complete_text(
        self,
        *,
        system: str,
        user_parts: list[dict[str, Any]],
    ) -> str:
        """Return the model's text answer."""


class LLMGroundedReasonGenerator:
    def __init__(
        self,
        client: LLMClient,
        *,
        fallback: GroundedReasonGenerator | None = None,
    ) -> None:
        self._client = client
        self._fallback = fallback or GroundedReasonGenerator()

    def generate(
        self,
        *,
        intent: RecommendationIntent,
        product: dict[str, Any],
        retrieval_score: float,
        compatibility: CompatibilityScore,
        filters: SearchFilters,
    ) -> str:
        facts, allowed_labels = _build_facts(
            intent=intent,
            product=product,
            retrieval_score=retrieval_score,
            compatibility=compatibility,
            filters=filters,
        )
        try:
            answer = self._client.complete_text(
                system=_SYSTEM_PROMPT,
                user_parts=[
                    text_part(
                        json.dumps(facts, ensure_ascii=False)
                    )
                ],
            )
        except Exception:
            _logger.warning(
                "LLM reason generation failed; using rule-based reason",
                exc_info=True,
            )
            return self._rule_based(
                intent=intent,
                product=product,
                retrieval_score=retrieval_score,
                compatibility=compatibility,
                filters=filters,
            )
        reason = " ".join(answer.split())
        if not _is_grounded(reason, allowed_labels):
            _logger.warning(
                "LLM reason rejected as ungrounded for product %s",
                product.get("product_id"),
            )
            return self._rule_based(
                intent=intent,
                product=product,
                retrieval_score=retrieval_score,
                compatibility=compatibility,
                filters=filters,
            )
        return reason

    def _rule_based(self, **kwargs: Any) -> str:
        return self._fallback.generate(**kwargs)


def _build_facts(
    *,
    intent: RecommendationIntent,
    product: dict[str, Any],
    retrieval_score: float,
    compatibility: CompatibilityScore,
    filters: SearchFilters,
) -> tuple[dict[str, Any], set[str]]:
    product_tags = infer_product_tags(product)
    price = int(product["price"])
    budget_fit = price >= filters.budget_min and (
        filters.budget_max is None or price <= filters.budget_max
    )
    facts = {
        "상품": {
            "이름": product.get("name"),
            "브랜드": product.get("brand"),
            "분류": (
                f"{product.get('category')}/"
                f"{product.get('subcategory')}"
            ),
            "가격": price,
            "상품_태그": {
                "색상": _label_list(product_tags.colors, _COLOR_LABELS),
                "계절": _label_list(
                    product_tags.seasons,
                    _SEASON_LABELS,
                ),
                "스타일": _label_list(
                    product_tags.styles,
                    _STYLE_LABELS,
                ),
                "패턴": _label_list(
                    product_tags.patterns,
                    _PATTERN_LABELS,
                ),
            },
        },
        "사용자_조건과_일치": {
            "색상": _label_list(
                frozenset(compatibility.matched_colors),
                _COLOR_LABELS,
            ),
            "계절": _label_list(
                frozenset(compatibility.matched_seasons),
                _SEASON_LABELS,
            ),
            "스타일": _label_list(
                frozenset(compatibility.matched_styles),
                _STYLE_LABELS,
            ),
            "패턴": _label_list(
                frozenset(compatibility.matched_patterns),
                _PATTERN_LABELS,
            ),
        },
        "예산_범위_안": budget_fit,
        "점수": {
            "유사도": round(retrieval_score, 3),
            "궁합": round(compatibility.total, 3),
        },
    }
    allowed = set()
    for tag_set, labels in (
        (product_tags.colors, _COLOR_LABELS),
        (product_tags.seasons, _SEASON_LABELS),
        (product_tags.styles, _STYLE_LABELS),
        (product_tags.patterns, _PATTERN_LABELS),
        (intent.tags.colors, _COLOR_LABELS),
        (intent.tags.seasons, _SEASON_LABELS),
        (intent.tags.styles, _STYLE_LABELS),
        (intent.tags.patterns, _PATTERN_LABELS),
    ):
        allowed.update(
            labels[code] for code in tag_set if code in labels
        )
    return facts, allowed


def _label_list(
    codes: frozenset[str],
    labels: dict[str, str],
) -> list[str]:
    return sorted(labels.get(code, code) for code in codes)


def _is_grounded(reason: str, allowed_labels: set[str]) -> bool:
    if not reason or len(reason) > MAX_REASON_LENGTH:
        return False
    for label in _ALL_TAG_LABELS:
        if label in reason and label not in allowed_labels:
            return False
    return True


__all__ = [
    "LLMGroundedReasonGenerator",
    "MAX_REASON_LENGTH",
]
