"""VLM pairwise outfit-compatibility scoring for top candidates.

Replaces the rule-based compatibility total with a real pairwise
judgment (query outfit/text vs. candidate garment) for the top-N
retrieval candidates only, keeping cost and latency bounded. Anything
below the rerank window and every VLM failure keeps its rule-based
score, so the reranker can never make the pipeline less available.

The candidate's primary image is fetched through the same allowlisted
fetcher used for query images; when the image cannot be fetched the
judgment falls back to the candidate's validated metadata only.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Protocol

from app.recommendation.pipeline import (
    DEFAULT_RERANK_TOP_K,
    MAX_RERANK_TOP_K,
    RecommendationIntent,
    infer_product_tags,
)
from app.recommendation.vlm import VLMError, image_part, text_part

_logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are a fashion stylist judging outfit compatibility. Score "
    "how well the candidate garment would pair with the user's query "
    "outfit (photo and/or text) as one coordinated look. Judge color "
    "harmony, season consistency, style/mood, and pattern mixing. "
    "Respond with one JSON object only, no explanation: "
    "{\"compatibility\": <number 0.0-1.0>}. 0.0 = clashes badly, "
    "0.5 = neutral, 1.0 = excellent match."
)

# Score-only answers are ~10 tokens, but reasoning models spend a
# variable number of hidden reasoning tokens against the same cap, so
# leave headroom instead of squeezing the cap.
_JUDGMENT_MAX_TOKENS = 256


class VLMClient(Protocol):
    def complete_json(
        self,
        *,
        system: str,
        user_parts: list[dict[str, Any]],
        max_tokens: int | None = None,
        reasoning_effort: str | None = None,
    ) -> dict[str, Any]:
        """Return one parsed JSON object from the model."""


class ProductImageFetcher(Protocol):
    def fetch(self, url: str) -> Any:
        """Fetch a validated image; result has content and mime_type."""


@dataclass(frozen=True)
class PairwiseJudgment:
    compatibility: float
    rationale: str | None = None


class PairwiseCompatibilityModel(Protocol):
    def score_pair(
        self,
        *,
        intent: RecommendationIntent,
        query_image: bytes | None,
        query_mime_type: str | None,
        product: dict[str, Any],
    ) -> PairwiseJudgment:
        """Judge query-candidate outfit compatibility in [0, 1]."""


class VLMPairwiseCompatibilityModel:
    def __init__(
        self,
        client: VLMClient,
        *,
        product_image_fetcher: ProductImageFetcher | None = None,
        reasoning_effort: str | None = None,
    ) -> None:
        # Reasoning control is per-model: OpenAI reasoning models need
        # a bounded effort or hidden reasoning eats the token cap, but
        # some providers (e.g. Gemma) reject the field outright, so it
        # must stay configurable instead of hardcoded.
        self._client = client
        self._product_image_fetcher = product_image_fetcher
        self._reasoning_effort = reasoning_effort

    def score_pair(
        self,
        *,
        intent: RecommendationIntent,
        query_image: bytes | None,
        query_mime_type: str | None,
        product: dict[str, Any],
    ) -> PairwiseJudgment:
        user_parts: list[dict[str, Any]] = []
        if query_image is not None and query_mime_type is not None:
            user_parts.append(text_part("사용자 기준 이미지:"))
            user_parts.append(
                image_part(query_image, query_mime_type)
            )
        if intent.query_text:
            user_parts.append(
                text_part(f"사용자 요청 텍스트: {intent.query_text}")
            )
        user_parts.append(text_part(_candidate_summary(product)))
        candidate_image = self._fetch_candidate_image(product)
        if candidate_image is not None:
            user_parts.append(text_part("후보 상품 이미지:"))
            user_parts.append(
                image_part(
                    candidate_image.content,
                    candidate_image.mime_type,
                )
            )
        payload = self._client.complete_json(
            system=_SYSTEM_PROMPT,
            user_parts=user_parts,
            max_tokens=_JUDGMENT_MAX_TOKENS,
            reasoning_effort=self._reasoning_effort,
        )
        return _judgment_from_payload(payload)

    def _fetch_candidate_image(self, product: dict[str, Any]) -> Any:
        if self._product_image_fetcher is None:
            return None
        try:
            return self._product_image_fetcher.fetch(
                str(product["image_url"])
            )
        except Exception:
            _logger.warning(
                "candidate image fetch failed for product %s; "
                "judging from metadata only",
                product.get("product_id"),
                exc_info=True,
            )
            return None


def _candidate_summary(product: dict[str, Any]) -> str:
    tags = infer_product_tags(product)
    return (
        "후보 상품 정보: "
        f"이름={product.get('name')}, "
        f"브랜드={product.get('brand')}, "
        f"분류={product.get('category')}/{product.get('subcategory')}, "
        f"colors={sorted(tags.colors)}, "
        f"seasons={sorted(tags.seasons)}, "
        f"styles={sorted(tags.styles)}, "
        f"patterns={sorted(tags.patterns)}"
    )


def _judgment_from_payload(payload: dict[str, Any]) -> PairwiseJudgment:
    compatibility = payload.get("compatibility")
    if isinstance(compatibility, bool) or not isinstance(
        compatibility,
        (int, float),
    ):
        raise VLMError(
            "pairwise judgment must contain a numeric compatibility"
        )
    value = float(compatibility)
    if value < -0.01 or value > 1.01:
        raise VLMError(
            "pairwise compatibility must be between 0.0 and 1.0"
        )
    return PairwiseJudgment(
        compatibility=max(0.0, min(1.0, value)),
    )


__all__ = [
    "DEFAULT_RERANK_TOP_K",
    "MAX_RERANK_TOP_K",
    "PairwiseCompatibilityModel",
    "PairwiseJudgment",
    "VLMPairwiseCompatibilityModel",
]
