from fastapi import APIRouter

from app.api.routes import evaluation

api_router = APIRouter()
api_router.include_router(
    evaluation.router,
    prefix="/evaluation",
    tags=["image-model-evaluation"],
)
