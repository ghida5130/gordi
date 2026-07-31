"""Lazy runtime assembly of the multimodal recommendation pipeline."""

from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.recommendation.catalog_embeddings import (
    CatalogEmbeddingError,
    EmbeddingSettings,
    GeminiEmbeddingProvider,
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
    if not settings.gemini_api_key.strip():
        raise RecommendationRuntimeError("GEMINI_API_KEY is not configured")
    try:
        index = CatalogVectorIndex.load(
            settings.catalog_embedding_index_path
        )
        provider = GeminiEmbeddingProvider(
            EmbeddingSettings(
                api_key=settings.gemini_api_key,
                model=settings.gemini_embedding_model,
                dimensions=settings.gemini_embedding_dimensions,
            )
        )
        retriever = CandidateRetriever(index, provider)
    except (CatalogEmbeddingError, VectorIndexError) as exc:
        raise RecommendationRuntimeError(str(exc)) from exc
    return RecommendationPipeline(
        retriever,
        index_version=index.snapshot_sha256,
    )
