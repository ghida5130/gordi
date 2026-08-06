from fastapi import APIRouter

from app.api.routes import health, recommendation_demo

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(
    recommendation_demo.api_router,
    tags=["recommendation-demo"],
)
api_router.include_router(
    recommendation_demo.tpo_api_router,
    tags=["tpo-eval"],
)
