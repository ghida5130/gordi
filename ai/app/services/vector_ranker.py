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
import threading
import time
from concurrent.futures import ThreadPoolExecutor

from app.recommendation.catalog_embeddings import CatalogEmbeddingError
from app.recommendation.pipeline import (
    COMPATIBILITY_WEIGHT,
    DEFAULT_RERANK_CONCURRENCY,
    DEFAULT_RERANK_TOP_K,
    RETRIEVAL_WEIGHT,
    GarmentTags,
    RecommendationIntent,
    RuleBasedCompatibilityModel,
    parse_recommendation_intent,
    should_skip_vlm_rerank,
)
from app.recommendation.vlm_reranker import PairwiseCompatibilityModel
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
        *,
        reranker: PairwiseCompatibilityModel | None = None,
        rerank_top_k: int = DEFAULT_RERANK_TOP_K,
        rerank_concurrency: int = DEFAULT_RERANK_CONCURRENCY,
        rerank_mode: str = "always",
    ) -> None:
        self._index = index
        self._provider = provider
        self._compatibility = RuleBasedCompatibilityModel()
        # /search 와 동일한 opt-in VLM pairwise rerank. 실패한 판정은
        # 규칙 점수를 유지하므로 랭킹 가용성에는 영향을 주지 않는다.
        self._reranker = reranker
        self._rerank_top_k = rerank_top_k
        self._rerank_concurrency = rerank_concurrency
        self._rerank_mode = rerank_mode

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

        # TPO 문장이 포함된 질의에서 색상·계절·스타일 태그를 추론해
        # ("여름 결혼식" → SUMMER 등) 무드 스타일과 병합한다. VLM
        # 리랭크 프롬프트도 intent.query_text 를 그대로 쓰므로 TPO 는
        # 임베딩·규칙 궁합·pairwise 판정 세 단계 모두에 반영된다.
        inferred = parse_recommendation_intent(query_text).tags
        intent = RecommendationIntent(
            query_text=query_text,
            tags=inferred.merge(
                GarmentTags(
                    styles=frozenset(
                        _MOOD_STYLE_TAGS[mood]
                        for mood in condition.moods
                        if mood in _MOOD_STYLE_TAGS
                    )
                )
            ),
        )

        matched = 0
        scored: list[tuple[float, float, RankCandidate]] = []
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
            scored.append(
                (min(max(final, 0.0), 1.0), retrieval, candidate)
            )

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
                item[2].price,
                item[2].product_id,
            )
        )
        if self._reranker is not None and not (
            self._rerank_mode == "selective"
            and should_skip_vlm_rerank(query_text, has_image=False)
        ):
            scored = self._rerank_pairwise(scored, intent)
        return [
            RankedProduct(
                product_id=candidate.product_id,
                rank=position,
                score=round(score, 6),
            )
            for position, (score, _retrieval, candidate) in enumerate(
                scored[:limit],
                start=1,
            )
        ]

    def _rerank_pairwise(
        self,
        scored: list[tuple[float, float, RankCandidate]],
        intent: RecommendationIntent,
    ) -> list[tuple[float, float, RankCandidate]]:
        """Re-judge the top-K compatibility with the VLM, in parallel.

        Mirrors the `/search` pipeline semantics: only the top-K window
        is judged, a successful judgment replaces the rule-based
        compatibility inside the final blend, and any failure keeps the
        original score so the reranker never degrades availability.
        """
        assert self._reranker is not None
        top_k = min(self._rerank_top_k, len(scored))
        failures = 0
        failure_lock = threading.Lock()

        def judge(
            entry: tuple[float, float, RankCandidate],
        ) -> tuple[float, float, RankCandidate]:
            final, retrieval, candidate = entry
            product = self._index.product_by_id(candidate.product_id)
            if product is None:
                # 인덱스 밖 후보는 이미지 없이 메타데이터로만 판정한다.
                product = {
                    "product_id": candidate.product_id,
                    "name": candidate.name,
                    "brand": candidate.brand,
                    "category": candidate.category,
                    "subcategory": candidate.subcategory,
                    "description": candidate.description,
                }
            try:
                judgment = self._reranker.score_pair(
                    intent=intent,
                    query_image=None,
                    query_mime_type=None,
                    product=product,
                )
            except Exception:
                nonlocal failures
                with failure_lock:
                    failures += 1
                logger.warning(
                    "pairwise rerank failed for product %s; "
                    "keeping rule-based score",
                    candidate.product_id,
                    exc_info=True,
                )
                return entry
            compatibility = min(
                max(float(judgment.compatibility), 0.0),
                1.0,
            )
            final = (
                RETRIEVAL_WEIGHT * retrieval
                + COMPATIBILITY_WEIGHT * compatibility
            )
            return (min(max(final, 0.0), 1.0), retrieval, candidate)

        workers = max(1, min(self._rerank_concurrency, top_k))
        started = time.perf_counter()
        with ThreadPoolExecutor(max_workers=workers) as executor:
            reranked = list(executor.map(judge, scored[:top_k]))
        logger.info(
            "pairwise rerank (/rank): top_k=%d workers=%d "
            "failed=%d elapsed=%.2fs",
            top_k,
            workers,
            failures,
            time.perf_counter() - started,
        )
        reranked.extend(scored[top_k:])
        reranked.sort(
            key=lambda item: (
                -item[0],
                item[2].price,
                item[2].product_id,
            )
        )
        return reranked


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
    base = " ".join(words) + " 코디"
    # TPO 자유 텍스트는 문장으로 덧붙인다 — 임베딩 모델은 라벨
    # 나열보다 자연어 문맥에서 상황(격식·장소·계절)을 잘 싣는다.
    tpo = (condition.tpo or "").strip()
    if tpo:
        return f"{base}. 상황: {tpo}"
    return base


__all__ = [
    "VectorRankError",
    "VectorRecommendationRanker",
]
