from fastapi import APIRouter, Depends

from app.core.security import verify_internal_api_key
from app.schemas.recommendation import RankRequest, RankResponse
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
