"""Shared FastAPI dependencies for recommendation runtime access."""

from fastapi import Depends, HTTPException, status

from app.core.config import Settings, get_settings
from app.recommendation.pipeline import RecommendationPipeline
from app.services.recommendation_pipeline import (
    RecommendationRuntimeError,
    get_recommendation_pipeline,
)


def require_recommendation_pipeline() -> RecommendationPipeline:
    try:
        return get_recommendation_pipeline()
    except RecommendationRuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


def require_recommendation_demo(
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.enable_recommendation_demo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )
