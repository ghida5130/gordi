import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import require_recommendation_pipeline
from app.core.config import Settings, get_settings
from app.core.security import verify_internal_api_key
from app.recommendation.image_fetcher import (
    QueryImageError,
    QueryImageFetcher,
)
from app.recommendation.pipeline import (
    RecommendationPipeline,
    RecommendationPipelineError,
)
from app.recommendation.vector_index import (
    SearchFilters,
    VectorIndexError,
)
from app.schemas.recommendation import (
    RankRequest,
    RankResponse,
    RecommendedProduct,
    SearchRecommendationRequest,
    SearchRecommendationResponse,
)
from app.services.recommendation_pipeline import (
    RecommendationRuntimeError,
    get_catalog_index,
    get_embedding_provider,
    get_pairwise_reranker,
)
from app.services.recommendation_ranker import (
    SCHEMA_VERSION,
    recommendation_ranker,
)
from app.services.vector_ranker import (
    VectorRankError,
    VectorRecommendationRanker,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/recommendations",
    dependencies=[Depends(verify_internal_api_key)],
)


def get_vector_ranker(
    settings: Settings = Depends(get_settings),
) -> VectorRecommendationRanker | None:
    """Vector ranker when the runtime allows it; None → keyword baseline."""
    if not settings.recommendation_rank_vector_enabled:
        return None
    reranker = None
    if settings.recommendation_vlm_rerank_enabled:
        try:
            reranker = get_pairwise_reranker()
        except RecommendationRuntimeError as exc:
            # 품질 레이어는 랭킹 가용성을 깎지 않는다 — VLM 런타임이
            # 없으면 벡터 랭킹만으로 진행한다.
            logger.warning(
                "vlm rerank runtime unavailable (%s); "
                "ranking without it",
                exc,
            )
    try:
        return VectorRecommendationRanker(
            get_catalog_index(),
            get_embedding_provider(),
            reranker=reranker,
            rerank_top_k=settings.recommendation_vlm_rerank_top_k,
            rerank_concurrency=(
                settings.recommendation_vlm_rerank_concurrency
            ),
            rerank_mode=settings.recommendation_vlm_rerank_mode,
            rerank_deadline_seconds=(
                settings.recommendation_vlm_rerank_deadline_seconds
            ),
        )
    except RecommendationRuntimeError as exc:
        logger.warning(
            "vector rank runtime unavailable (%s); using baseline",
            exc,
        )
        return None


@router.post(
    "/rank",
    response_model=RankResponse,
    summary="추천 후보 상품 순위 계산",
)
async def rank_recommendations(
    request: RankRequest,
    vector_ranker: VectorRecommendationRanker | None = Depends(
        get_vector_ranker
    ),
) -> RankResponse:
    if vector_ranker is not None:
        try:
            ranked = vector_ranker.rank(
                condition=request.condition,
                candidates=request.candidates,
                limit=request.limit,
            )
            return RankResponse(
                schema_version=SCHEMA_VERSION,
                ranked=ranked,
            )
        except VectorRankError:
            # Ranking must stay available even when embeddings or the
            # snapshot generation are broken — fall through to the
            # deterministic keyword baseline.
            logger.warning(
                "vector rank failed; falling back to baseline",
                exc_info=True,
            )
    ranked = recommendation_ranker.rank(
        condition=request.condition,
        candidates=request.candidates,
        limit=request.limit,
    )
    return RankResponse(schema_version=SCHEMA_VERSION, ranked=ranked)


def get_query_image_fetcher(
    settings: Settings = Depends(get_settings),
) -> QueryImageFetcher:
    return QueryImageFetcher.create(
        settings.recommendation_image_allowed_hosts
    )


@router.post(
    "/search",
    response_model=SearchRecommendationResponse,
    summary="멀티모달 의류 후보 검색·재정렬",
)
def search_recommendations(
    request: SearchRecommendationRequest,
    pipeline: RecommendationPipeline = Depends(
        require_recommendation_pipeline
    ),
    image_fetcher: QueryImageFetcher = Depends(
        get_query_image_fetcher
    ),
) -> SearchRecommendationResponse:
    resolved_image = None
    try:
        if request.image_url:
            resolved_image = image_fetcher.fetch(request.image_url)
        results = pipeline.recommend(
            text=request.text,
            image=(
                None if resolved_image is None else resolved_image.content
            ),
            mime_type=(
                None if resolved_image is None else resolved_image.mime_type
            ),
            filters=SearchFilters(
                gender=request.gender,
                category=request.category,
                subcategory=request.subcategory,
                budget_min=request.budget_min,
                budget_max=request.budget_max,
            ),
            candidate_limit=request.candidate_limit,
            result_limit=request.result_limit,
        )
    except QueryImageError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except (RecommendationPipelineError, VectorIndexError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    finally:
        image_fetcher.close()

    return SearchRecommendationResponse(
        schema_version="1.0",
        recommendation_id=request.recommendation_id,
        index_version=pipeline.index_version,
        results=[
            RecommendedProduct(
                product_id=result.product_id,
                rank=result.rank,
                score=round(result.score, 6),
                retrieval_score=round(result.retrieval_score, 6),
                compatibility_score=round(
                    result.compatibility_score,
                    6,
                ),
                reason=result.reason,
            )
            for result in results
        ],
    )
