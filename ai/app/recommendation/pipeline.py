"""End-to-end retrieval, rule-based compatibility, and grounded reasons."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, replace
from typing import Any, Protocol

from app.recommendation.vector_index import (
    DEFAULT_RETRIEVAL_LIMIT,
    CandidateRetriever,
    SearchFilters,
    SearchHit,
)

DEFAULT_RESULT_LIMIT = 10
MAX_RESULT_LIMIT = 50
RETRIEVAL_WEIGHT = 0.65
COMPATIBILITY_WEIGHT = 0.35

_COLOR_KEYWORDS = {
    "BLACK": ("블랙", "검정", "검은", "black"),
    "WHITE": ("화이트", "흰색", "하양", "white", "아이보리", "ivory"),
    "GRAY": ("그레이", "회색", "gray", "grey", "차콜", "charcoal"),
    "NAVY": ("네이비", "navy"),
    "BLUE": ("블루", "파랑", "청색", "blue", "데님", "denim"),
    "RED": ("레드", "빨강", "red", "버건디", "burgundy"),
    "PINK": ("핑크", "분홍", "pink"),
    "GREEN": ("그린", "초록", "카키", "green", "khaki"),
    "BEIGE": ("베이지", "크림", "beige", "cream"),
    "BROWN": ("브라운", "갈색", "brown", "카멜", "camel"),
    "YELLOW": ("옐로", "노랑", "yellow"),
    "PURPLE": ("퍼플", "보라", "purple", "바이올렛", "violet"),
    "ORANGE": ("오렌지", "주황", "orange"),
}
_SEASON_KEYWORDS = {
    "SPRING": ("봄", "spring"),
    "SUMMER": ("여름", "summer"),
    "FALL": ("가을", "간절기", "fall", "autumn"),
    "WINTER": ("겨울", "winter"),
}
_STYLE_KEYWORDS = {
    "CASUAL": ("캐주얼", "데일리", "casual", "daily"),
    "MINIMAL": ("미니멀", "심플", "베이직", "minimal", "simple", "basic"),
    "STREET": ("스트릿", "스트리트", "오버핏", "street", "oversized"),
    "SPORTY": ("스포티", "스포츠", "애슬레저", "sporty", "sports", "athleisure"),
    "FORMAL": ("포멀", "오피스", "정장", "formal", "office", "business"),
    "ROMANTIC": ("로맨틱", "페미닌", "러블리", "romantic", "feminine"),
    "VINTAGE": ("빈티지", "레트로", "vintage", "retro"),
}
_PATTERN_KEYWORDS = {
    "SOLID": ("무지", "솔리드", "solid", "plain"),
    "STRIPE": ("스트라이프", "줄무늬", "stripe", "striped"),
    "CHECK": ("체크", "깅엄", "check", "checked", "plaid", "gingham"),
    "DOT": ("도트", "물방울", "dot", "polka"),
    "FLORAL": ("플로럴", "플라워", "꽃무늬", "floral", "flower"),
    "GRAPHIC": ("그래픽", "프린트", "로고", "graphic", "print", "logo"),
    "ANIMAL": ("레오파드", "호피", "지브라", "leopard", "zebra", "animal"),
}
_COLOR_LABELS = {
    "BLACK": "블랙",
    "WHITE": "화이트",
    "GRAY": "그레이",
    "NAVY": "네이비",
    "BLUE": "블루",
    "RED": "레드",
    "PINK": "핑크",
    "GREEN": "그린",
    "BEIGE": "베이지",
    "BROWN": "브라운",
    "YELLOW": "옐로",
    "PURPLE": "퍼플",
    "ORANGE": "오렌지",
}
_SEASON_LABELS = {
    "SPRING": "봄",
    "SUMMER": "여름",
    "FALL": "가을",
    "WINTER": "겨울",
}
_STYLE_LABELS = {
    "CASUAL": "캐주얼",
    "MINIMAL": "미니멀",
    "STREET": "스트릿",
    "SPORTY": "스포티",
    "FORMAL": "포멀",
    "ROMANTIC": "로맨틱",
    "VINTAGE": "빈티지",
}
_PATTERN_LABELS = {
    "SOLID": "무지",
    "STRIPE": "스트라이프",
    "CHECK": "체크",
    "DOT": "도트",
    "FLORAL": "플로럴",
    "GRAPHIC": "그래픽",
    "ANIMAL": "애니멀",
}
_PATTERN_NEUTRALS = {"SOLID"}
_NEUTRAL_COLORS = {"BLACK", "WHITE", "GRAY", "NAVY", "BEIGE", "BROWN"}
_HARMONIOUS_COLOR_PAIRS = {
    frozenset(("BLUE", "ORANGE")),
    frozenset(("RED", "GREEN")),
    frozenset(("YELLOW", "PURPLE")),
    frozenset(("BLUE", "BEIGE")),
    frozenset(("PINK", "GRAY")),
    frozenset(("GREEN", "BROWN")),
}
_SUBCATEGORY_SEASONS = {
    "SHORT_SLEEVE": {"SUMMER"},
    "SLEEVELESS": {"SUMMER"},
    "SHORTS": {"SUMMER"},
    "KNIT": {"FALL", "WINTER"},
    "HOODIE": {"FALL", "WINTER"},
    "LONG_SLEEVE": {"SPRING", "FALL"},
    "SHIRT": {"SPRING", "FALL"},
    "SLACKS": {"SPRING", "FALL"},
    "DENIM_PANTS": {"SPRING", "FALL"},
    "COTTON_PANTS": {"SPRING", "FALL"},
}
_SUBCATEGORY_STYLES = {
    "SHORT_SLEEVE": {"CASUAL"},
    "LONG_SLEEVE": {"CASUAL"},
    "DENIM_PANTS": {"CASUAL"},
    "COTTON_PANTS": {"CASUAL"},
    "HOODIE": {"CASUAL", "STREET"},
    "JOGGER_PANTS": {"CASUAL", "SPORTY"},
    "SPORTS_TOP": {"SPORTY"},
    "SPORTS_BOTTOM": {"SPORTY"},
    "SHIRT": {"FORMAL"},
    "SLACKS": {"FORMAL"},
}


_logger = logging.getLogger(__name__)


class RecommendationPipelineError(RuntimeError):
    """Raised when a recommendation request cannot be processed."""


@dataclass(frozen=True)
class GarmentTags:
    colors: frozenset[str] = frozenset()
    seasons: frozenset[str] = frozenset()
    styles: frozenset[str] = frozenset()
    patterns: frozenset[str] = frozenset()

    def merge(self, other: "GarmentTags") -> "GarmentTags":
        return GarmentTags(
            colors=self.colors | other.colors,
            seasons=self.seasons | other.seasons,
            styles=self.styles | other.styles,
            patterns=self.patterns | other.patterns,
        )


@dataclass(frozen=True)
class RecommendationIntent:
    query_text: str | None
    tags: GarmentTags


@dataclass(frozen=True)
class CompatibilityScore:
    total: float
    color: float | None
    season: float | None
    style: float | None
    pattern: float | None = None
    matched_colors: tuple[str, ...] = ()
    matched_seasons: tuple[str, ...] = ()
    matched_styles: tuple[str, ...] = ()
    matched_patterns: tuple[str, ...] = ()


@dataclass(frozen=True)
class RecommendationResult:
    product_id: int
    rank: int
    score: float
    retrieval_score: float
    compatibility_score: float
    reason: str
    product: dict[str, Any]


class CandidateRetrieval(Protocol):
    def retrieve(
        self,
        *,
        text: str | None,
        image: bytes | None,
        mime_type: str | None,
        filters: SearchFilters,
        limit: int = DEFAULT_RETRIEVAL_LIMIT,
    ) -> list[SearchHit]:
        """Return metadata-filtered multimodal candidates."""


class CompatibilityModel(Protocol):
    def score(
        self,
        intent: RecommendationIntent,
        product: dict[str, Any],
    ) -> CompatibilityScore:
        """Score grounded color, season, and style compatibility."""


class ImageIntentExtractor(Protocol):
    def extract(
        self,
        *,
        image: bytes,
        mime_type: str,
    ) -> GarmentTags:
        """Extract closed-vocabulary garment tags from a query image."""


class RecommendationReasonGenerator(Protocol):
    def generate(
        self,
        *,
        intent: RecommendationIntent,
        product: dict[str, Any],
        retrieval_score: float,
        compatibility: CompatibilityScore,
        filters: SearchFilters,
    ) -> str:
        """Generate a reason using only observed inputs and product data."""


class RuleBasedCompatibilityModel:
    def score(
        self,
        intent: RecommendationIntent,
        product: dict[str, Any],
    ) -> CompatibilityScore:
        product_tags = infer_product_tags(product)
        color, matched_colors = _set_compatibility(
            intent.tags.colors,
            product_tags.colors,
            color_mode=True,
        )
        season, matched_seasons = _set_compatibility(
            intent.tags.seasons,
            product_tags.seasons,
        )
        style, matched_styles = _set_compatibility(
            intent.tags.styles,
            product_tags.styles,
        )
        pattern, matched_patterns = _set_compatibility(
            intent.tags.patterns,
            product_tags.patterns,
            pattern_mode=True,
        )
        components = [
            component
            for component in (color, season, style, pattern)
            if component is not None
        ]
        total = sum(components) / len(components) if components else 0.5
        return CompatibilityScore(
            total=total,
            color=color,
            season=season,
            style=style,
            pattern=pattern,
            matched_colors=tuple(sorted(matched_colors)),
            matched_seasons=tuple(sorted(matched_seasons)),
            matched_styles=tuple(sorted(matched_styles)),
            matched_patterns=tuple(sorted(matched_patterns)),
        )


class GroundedReasonGenerator:
    def generate(
        self,
        *,
        intent: RecommendationIntent,
        product: dict[str, Any],
        retrieval_score: float,
        compatibility: CompatibilityScore,
        filters: SearchFilters,
    ) -> str:
        del intent
        parts: list[str] = []
        if compatibility.matched_colors:
            labels = _labels(
                compatibility.matched_colors,
                _COLOR_LABELS,
            )
            parts.append(f"입력에서 감지한 {labels} 계열과 잘 연결됩니다")
        if compatibility.matched_seasons:
            labels = _labels(
                compatibility.matched_seasons,
                _SEASON_LABELS,
            )
            parts.append(f"{labels} 활용 조건과 맞습니다")
        if compatibility.matched_styles:
            labels = _labels(
                compatibility.matched_styles,
                _STYLE_LABELS,
            )
            parts.append(f"{labels} 무드가 이어집니다")
        if compatibility.matched_patterns:
            labels = _labels(
                compatibility.matched_patterns,
                _PATTERN_LABELS,
            )
            parts.append(f"{labels} 패턴 결이 같습니다")
        if not parts:
            parts.append(
                "입력 이미지와 텍스트의 멀티모달 특징이 유사합니다"
            )
        price = int(product["price"])
        if (
            price >= filters.budget_min
            and (
                filters.budget_max is None
                or price <= filters.budget_max
            )
        ):
            parts.append("설정한 예산 범위 안의 상품입니다")
        return ". ".join(parts[:3]) + "."


class RecommendationPipeline:
    def __init__(
        self,
        retriever: CandidateRetrieval,
        *,
        compatibility_model: CompatibilityModel | None = None,
        reason_generator: RecommendationReasonGenerator | None = None,
        image_intent_extractor: ImageIntentExtractor | None = None,
        index_version: str = "0" * 64,
    ) -> None:
        if len(index_version) != 64 or any(
            character not in "0123456789abcdef"
            for character in index_version.casefold()
        ):
            raise RecommendationPipelineError(
                "index_version must be a SHA-256 hex digest"
            )
        self._retriever = retriever
        self.index_version = index_version
        self._compatibility_model = (
            compatibility_model or RuleBasedCompatibilityModel()
        )
        self._reason_generator = (
            reason_generator or GroundedReasonGenerator()
        )
        self._image_intent_extractor = image_intent_extractor

    def recommend(
        self,
        *,
        text: str | None,
        image: bytes | None,
        mime_type: str | None,
        filters: SearchFilters,
        candidate_limit: int = DEFAULT_RETRIEVAL_LIMIT,
        result_limit: int = DEFAULT_RESULT_LIMIT,
    ) -> list[RecommendationResult]:
        if result_limit <= 0 or result_limit > MAX_RESULT_LIMIT:
            raise RecommendationPipelineError(
                f"result_limit must be between 1 and {MAX_RESULT_LIMIT}"
            )
        if candidate_limit < result_limit:
            raise RecommendationPipelineError(
                "candidate_limit must be greater than or equal to result_limit"
            )
        intent = parse_recommendation_intent(text)
        if (
            image is not None
            and mime_type is not None
            and self._image_intent_extractor is not None
        ):
            try:
                image_tags = self._image_intent_extractor.extract(
                    image=image,
                    mime_type=mime_type,
                )
            except Exception:
                # Image attributes only sharpen soft scoring; a VLM
                # outage must not take recommendations down with it.
                _logger.warning(
                    "image attribute extraction failed; "
                    "continuing with text-only intent",
                    exc_info=True,
                )
            else:
                intent = replace(
                    intent,
                    tags=intent.tags.merge(image_tags),
                )
        candidates = self._retriever.retrieve(
            text=text,
            image=image,
            mime_type=mime_type,
            filters=filters,
            limit=candidate_limit,
        )
        scored: list[
            tuple[float, float, SearchHit, CompatibilityScore]
        ] = []
        for candidate in candidates:
            compatibility = self._compatibility_model.score(
                intent,
                candidate.product,
            )
            retrieval = (candidate.score + 1.0) / 2.0
            final_score = (
                RETRIEVAL_WEIGHT * retrieval
                + COMPATIBILITY_WEIGHT * compatibility.total
            )
            scored.append(
                (
                    final_score,
                    retrieval,
                    candidate,
                    compatibility,
                )
            )
        scored.sort(key=lambda item: (-item[0], item[2].product_id))

        results: list[RecommendationResult] = []
        for rank, (
            final_score,
            retrieval,
            candidate,
            compatibility,
        ) in enumerate(scored[:result_limit], start=1):
            reason = self._reason_generator.generate(
                intent=intent,
                product=candidate.product,
                retrieval_score=retrieval,
                compatibility=compatibility,
                filters=filters,
            )
            results.append(
                RecommendationResult(
                    product_id=candidate.product_id,
                    rank=rank,
                    score=_clamp(final_score),
                    retrieval_score=_clamp(retrieval),
                    compatibility_score=_clamp(compatibility.total),
                    reason=reason,
                    product=candidate.product,
                )
            )
        return results


def parse_recommendation_intent(
    text: str | None,
) -> RecommendationIntent:
    normalized = (text or "").strip()
    return RecommendationIntent(
        query_text=normalized or None,
        tags=_infer_tags(normalized, subcategory=None),
    )


def infer_product_tags(product: dict[str, Any]) -> GarmentTags:
    text = " ".join(
        str(product.get(field) or "")
        for field in ("name", "description", "brand")
    )
    subcategory = str(product.get("subcategory") or "")
    return _infer_tags(text, subcategory=subcategory)


def _infer_tags(
    text: str,
    *,
    subcategory: str | None,
) -> GarmentTags:
    lowered = text.casefold()
    colors = _match_keywords(lowered, _COLOR_KEYWORDS)
    seasons = set(_match_keywords(lowered, _SEASON_KEYWORDS))
    styles = set(_match_keywords(lowered, _STYLE_KEYWORDS))
    patterns = _match_keywords(lowered, _PATTERN_KEYWORDS)
    if subcategory:
        seasons.update(_SUBCATEGORY_SEASONS.get(subcategory, set()))
        styles.update(_SUBCATEGORY_STYLES.get(subcategory, set()))
    return GarmentTags(
        colors=frozenset(colors),
        seasons=frozenset(seasons),
        styles=frozenset(styles),
        patterns=frozenset(patterns),
    )


def _match_keywords(
    text: str,
    mapping: dict[str, tuple[str, ...]],
) -> set[str]:
    return {
        label
        for label, keywords in mapping.items()
        if any(_contains_keyword(text, keyword) for keyword in keywords)
    }


def _contains_keyword(text: str, keyword: str) -> bool:
    if keyword.isascii():
        pattern = (
            rf"(?<![a-z0-9]){re.escape(keyword.casefold())}"
            rf"(?![a-z0-9])"
        )
        return re.search(pattern, text) is not None
    return keyword in text


def _set_compatibility(
    requested: frozenset[str],
    candidate: frozenset[str],
    *,
    color_mode: bool = False,
    pattern_mode: bool = False,
) -> tuple[float | None, set[str]]:
    if not requested:
        return None, set()
    if not candidate:
        return 0.5, set()
    matched = set(requested & candidate)
    if matched:
        return 1.0, matched
    if color_mode:
        if requested & _NEUTRAL_COLORS or candidate & _NEUTRAL_COLORS:
            return 0.8, set()
        if any(
            frozenset((left, right)) in _HARMONIOUS_COLOR_PAIRS
            for left in requested
            for right in candidate
        ):
            return 0.75, set()
    if pattern_mode and (
        requested & _PATTERN_NEUTRALS or candidate & _PATTERN_NEUTRALS
    ):
        return 0.8, set()
    return 0.2, set()


def _labels(values: tuple[str, ...], mapping: dict[str, str]) -> str:
    return "·".join(mapping.get(value, value) for value in values)


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


__all__ = [
    "COMPATIBILITY_WEIGHT",
    "CandidateRetriever",
    "CompatibilityScore",
    "GarmentTags",
    "GroundedReasonGenerator",
    "ImageIntentExtractor",
    "RETRIEVAL_WEIGHT",
    "RecommendationIntent",
    "RecommendationPipeline",
    "RecommendationPipelineError",
    "RecommendationResult",
    "RuleBasedCompatibilityModel",
    "infer_product_tags",
    "parse_recommendation_intent",
]
