"""Vector-based ranker for the Spring `/rank` contract.

Upgrades the deterministic keyword baseline to the multimodal catalog
pipeline without touching the public contract: the mood codes become
one embedded query, candidates are matched to their catalog vectors by
``product_id`` (both sides are the backend DB id), and the same
retrieval/compatibility blend used by `/search` produces the ranking.

The route keeps the keyword baseline as an automatic fallback, so this
ranker may raise on missing runtime pieces — availability is the
caller's concern, quality is this module's.
"""

from __future__ import annotations

import logging

from app.recommendation.catalog_embeddings import CatalogEmbeddingError
from app.recommendation.pipeline import (
    COMPATIBILITY_WEIGHT,
    RETRIEVAL_WEIGHT,
    GarmentTags,
    RecommendationIntent,
    RuleBasedCompatibilityModel,
)
from app.recommendation.vector_index import (
    CatalogVectorIndex,
    QueryEmbeddingProvider,
    VectorIndexError,
    _normalized_vector,
)
from app.schemas.recommendation import (
    RankCandidate,
    RankCondition,
    RankedProduct,
)

logger = logging.getLogger(__name__)

# Spring MoodCode → 임베딩 쿼리에 넣을 한국어 라벨.
_MOOD_LABELS = {
    "CASUAL": "캐주얼",
    "MINIMAL": "미니멀",
    "STREET": "스트릿",
    "CLASSIC": "클래식",
    "SPORTY": "스포티",
    "ROMANTIC": "로맨틱",
}
# Spring MoodCode → 규칙 궁합의 스타일 vocabulary. CLASSIC 은 가장
# 가까운 FORMAL 로 근사한다.
_MOOD_STYLE_TAGS = {
    "CASUAL": "CASUAL",
    "MINIMAL": "MINIMAL",
    "STREET": "STREET",
    "CLASSIC": "FORMAL",
    "SPORTY": "SPORTY",
    "ROMANTIC": "ROMANTIC",
}
_CATEGORY_LABELS = {"TOP": "상의", "BOTTOM": "하의"}


class VectorRankError(RuntimeError):
    """Raised when the vector ranker cannot produce a ranking."""


class VectorRecommendationRanker:
    def __init__(
        self,
        index: CatalogVectorIndex,
        provider: QueryEmbeddingProvider,
    ) -> None:
        self._index = index
        self._provider = provider
        self._compatibility = RuleBasedCompatibilityModel()

    def rank(
        self,
        condition: RankCondition,
        candidates: list[RankCandidate],
        limit: int,
    ) -> list[RankedProduct]:
        eligible = [
            candidate
            for candidate in candidates
            if _is_eligible(condition, candidate)
        ]
        if not eligible:
            return []

        query_text = _query_text(condition)
        try:
            raw = self._provider.embed_query(
                text=query_text,
                image=None,
                mime_type=None,
            )
            query = _normalized_vector(raw, self._index.dimensions)
        except (CatalogEmbeddingError, VectorIndexError) as exc:
            raise VectorRankError(str(exc)) from exc

        intent = RecommendationIntent(
            query_text=query_text,
            tags=GarmentTags(
                styles=frozenset(
                    _MOOD_STYLE_TAGS[mood]
                    for mood in condition.moods
                    if mood in _MOOD_STYLE_TAGS
                )
            ),
        )

        matched = 0
        scored: list[tuple[float, RankCandidate]] = []
        for candidate in eligible:
            vector = self._index.embedding_by_product_id(
                candidate.product_id
            )
            if vector is None:
                retrieval = 0.5
            else:
                matched += 1
                cosine = sum(
                    left * right
                    for left, right in zip(query, vector, strict=True)
                )
                retrieval = (max(-1.0, min(1.0, cosine)) + 1.0) / 2.0
            compatibility = self._compatibility.score(
                intent,
                {
                    "name": candidate.name,
                    "brand": candidate.brand,
                    "description": candidate.description,
                    "subcategory": candidate.subcategory,
                },
            )
            final = (
                RETRIEVAL_WEIGHT * retrieval
                + COMPATIBILITY_WEIGHT * compatibility.total
            )
            scored.append((round(min(max(final, 0.0), 1.0), 6), candidate))

        if matched == 0:
            # 스냅샷과 DB 가 서로 다른 세대(id 불일치)라는 신호다.
            # 전부 중립 점수로 랭킹하는 것보다 baseline 이 낫다.
            raise VectorRankError(
                "no candidate matched the vector index; "
                "is the snapshot built from this database?"
            )
        if matched < len(eligible):
            logger.warning(
                "vector rank partial index coverage: %d/%d candidates",
                matched,
                len(eligible),
            )

        scored.sort(
            key=lambda item: (
                -item[0],
                item[1].price,
                item[1].product_id,
            )
        )
        return [
            RankedProduct(
                product_id=candidate.product_id,
                rank=position,
                score=score,
            )
            for position, (score, candidate) in enumerate(
                scored[:limit],
                start=1,
            )
        ]


def _is_eligible(
    condition: RankCondition,
    candidate: RankCandidate,
) -> bool:
    if candidate.category != condition.category:
        return False
    if candidate.gender not in {condition.gender, "UNISEX"}:
        return False
    if (
        condition.subcategory is not None
        and candidate.subcategory != condition.subcategory
    ):
        return False
    return (
        condition.budget_min <= candidate.price <= condition.budget_max
    )


def _query_text(condition: RankCondition) -> str:
    words = [
        _MOOD_LABELS[mood]
        for mood in condition.moods
        if mood in _MOOD_LABELS
    ]
    words.append(
        _CATEGORY_LABELS.get(condition.category, condition.category)
    )
    return " ".join(words) + " 코디"


__all__ = [
    "VectorRankError",
    "VectorRecommendationRanker",
]
