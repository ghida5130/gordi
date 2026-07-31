from fastapi import APIRouter, Depends, HTTPException, status

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
    get_recommendation_pipeline,
)
from app.services.recommendation_ranker import (
    SCHEMA_VERSION,
    recommendation_ranker,
)

router = APIRouter(
    prefix="/recommendations",
    dependencies=[Depends(verify_internal_api_key)],
)


@router.post(
    "/rank",
    response_model=RankResponse,
    summary="추천 후보 상품 순위 계산",
)
async def rank_recommendations(request: RankRequest) -> RankResponse:
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


def require_recommendation_pipeline() -> RecommendationPipeline:
    try:
        return get_recommendation_pipeline()
    except RecommendationRuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


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
