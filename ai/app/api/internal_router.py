from fastapi import APIRouter

from app.api.routes import internal_recommendations, internal_tryon

internal_api_router = APIRouter(prefix="/internal/v1")
internal_api_router.include_router(internal_recommendations.router)
internal_api_router.include_router(internal_tryon.router)
