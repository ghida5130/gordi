from fastapi import APIRouter

from app.api.routes import recommendations

# 공개 API(/api/v1) 와 분리된 서비스 간 내부 호출 전용 라우터
internal_router = APIRouter()
internal_router.include_router(recommendations.router, tags=["internal-recommendations"])
