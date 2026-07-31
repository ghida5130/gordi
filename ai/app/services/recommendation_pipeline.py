"""Lazy runtime assembly of the multimodal recommendation pipeline."""

from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.recommendation.catalog_embeddings import (
    CatalogEmbeddingError,
    EmbeddingSettings,
    OpenRouterEmbeddingProvider,
)
from app.recommendation.pipeline import RecommendationPipeline
from app.recommendation.vector_index import (
    CandidateRetriever,
    CatalogVectorIndex,
    VectorIndexError,
)


class RecommendationRuntimeError(RuntimeError):
    """Raised when the configured recommendation runtime is unavailable."""


@lru_cache
def get_recommendation_pipeline() -> RecommendationPipeline:
    settings = get_settings()
    if not settings.openrouter_api_key.strip():
        raise RecommendationRuntimeError(
            "OPENROUTER_API_KEY is not configured"
        )
    try:
        index = CatalogVectorIndex.load(
            settings.catalog_embedding_index_path
        )
        provider = OpenRouterEmbeddingProvider(
            EmbeddingSettings(
                api_key=settings.openrouter_api_key,
                model=settings.openrouter_embedding_model,
                dimensions=settings.openrouter_embedding_dimensions,
                endpoint=settings.openrouter_embedding_endpoint,
                http_referer=(
                    settings.openrouter_http_referer.strip() or None
                ),
                app_title=settings.openrouter_app_title.strip() or None,
            )
        )
        retriever = CandidateRetriever(index, provider)
    except (CatalogEmbeddingError, VectorIndexError) as exc:
        raise RecommendationRuntimeError(str(exc)) from exc
    return RecommendationPipeline(
        retriever,
        index_version=index.snapshot_sha256,
    )
