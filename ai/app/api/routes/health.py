from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter()


@router.get("/health", summary="AI 서버 상태 확인")
async def health_check() -> dict[str, str]:
    settings = get_settings()
    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.environment,
    }
