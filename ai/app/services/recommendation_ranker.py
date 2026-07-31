import re
from dataclasses import dataclass

from app.schemas.recommendation import (
    RankCandidate,
    RankCondition,
    RankedProduct,
)

SCHEMA_VERSION = "2.0"
TOKEN_PATTERN = re.compile(r"[0-9A-Za-z가-힣]+")


@dataclass(frozen=True)
class ScoredCandidate:
    candidate: RankCandidate
    score: float


class RecommendationRanker:
    """Deterministic baseline ranker that can be replaced by a model later."""

    def rank(
        self,
        condition: RankCondition,
        candidates: list[RankCandidate],
        limit: int,
    ) -> list[RankedProduct]:
        eligible = [
            candidate
            for candidate in candidates
            if self._is_eligible(condition, candidate)
        ]
        scored = [
            ScoredCandidate(
                candidate=candidate,
                score=self._score(condition, candidate),
            )
            for candidate in eligible
        ]
        scored.sort(
            key=lambda item: (
                -item.score,
                item.candidate.price,
                item.candidate.product_id,
            )
        )

        return [
            RankedProduct(
                product_id=item.candidate.product_id,
                rank=index,
                score=item.score,
            )
            for index, item in enumerate(scored[:limit], start=1)
        ]

    @staticmethod
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
        return condition.budget_min <= candidate.price <= condition.budget_max

    def _score(
        self,
        condition: RankCondition,
        candidate: RankCandidate,
    ) -> float:
        budget_score = self._budget_score(
            condition.budget_min,
            condition.budget_max,
            candidate.price,
        )
        mood_score = self._mood_score(condition.moods, candidate)

        # Category eligibility is already enforced. The constant base keeps a
        # valid no-mood request in a useful 0..1 score range.
        score = 0.20 + (0.50 * budget_score) + (0.30 * mood_score)
        return round(min(max(score, 0.0), 1.0), 6)

    @staticmethod
    def _budget_score(budget_min: int, budget_max: int, price: int) -> float:
        if budget_min == budget_max:
            return 1.0

        midpoint = (budget_min + budget_max) / 2
        half_range = (budget_max - budget_min) / 2
        return max(0.0, 1.0 - (abs(price - midpoint) / half_range))

    @staticmethod
    def _mood_score(
        moods: list[str],
        candidate: RankCandidate,
    ) -> float:
        requested = {
            token.casefold()
            for mood in moods
            for token in TOKEN_PATTERN.findall(mood)
        }
        if not requested:
            return 0.5

        searchable = " ".join(
            filter(
                None,
                (
                    candidate.name,
                    candidate.brand,
                    candidate.description,
                ),
            )
        ).casefold()
        matches = sum(token in searchable for token in requested)
        return matches / len(requested)


recommendation_ranker = RecommendationRanker()
