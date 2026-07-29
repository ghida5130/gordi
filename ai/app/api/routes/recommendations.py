from fastapi import APIRouter, Depends

from app.api.deps import verify_internal_caller
from app.schemas.recommendation import RankRequest, RankResponse
from app.services.ranking import rank_candidates

router = APIRouter(dependencies=[Depends(verify_internal_caller)])


@router.post(
    "/recommendations/rank",
    response_model=RankResponse,
    summary="추천 후보 순위 계산",
)
async def rank(request: RankRequest) -> RankResponse:
    """후보가 비어 있으면 빈 순위를 반환한다(오류가 아니다)."""
    return rank_candidates(request)
