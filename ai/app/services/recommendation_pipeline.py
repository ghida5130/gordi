"""Lazy runtime assembly of the multimodal recommendation pipeline."""

from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.recommendation.catalog_embeddings import (
    CatalogEmbeddingError,
    EmbeddingSettings,
    OpenRouterEmbeddingProvider,
)
from app.recommendation.image_attributes import (
    VLMImageAttributeExtractor,
)
from app.recommendation.pipeline import RecommendationPipeline
from app.recommendation.vector_index import (
    CandidateRetriever,
    CatalogVectorIndex,
    VectorIndexError,
)
from app.recommendation.image_fetcher import QueryImageFetcher
from app.recommendation.llm_reasons import LLMGroundedReasonGenerator
from app.recommendation.vlm import (
    OpenAICompatibleVLMClient,
    VLMError,
    VLMSettings,
)
from app.recommendation.vlm_reranker import (
    VLMPairwiseCompatibilityModel,
)


class RecommendationRuntimeError(RuntimeError):
    """Raised when the configured recommendation runtime is unavailable."""


@lru_cache
def get_vlm_client() -> OpenAICompatibleVLMClient:
    """Build the shared OpenAI-compatible VLM client.

    The endpoint may be OpenRouter (needs an API key) or a local
    OpenAI-compatible server such as Ollama or vLLM (key optional).
    """
    settings = get_settings()
    api_key = (
        settings.recommendation_vlm_api_key.strip()
        or settings.openrouter_api_key.strip()
    )
    endpoint = settings.recommendation_vlm_endpoint
    if "openrouter.ai" in endpoint and not api_key:
        raise RecommendationRuntimeError(
            "recommendation VLM needs an API key for OpenRouter"
        )
    try:
        return OpenAICompatibleVLMClient(
            VLMSettings(
                model=settings.recommendation_vlm_model,
                endpoint=endpoint,
                api_key=api_key,
                timeout_seconds=(
                    settings.recommendation_vlm_timeout_seconds
                ),
                http_referer=(
                    settings.openrouter_http_referer.strip() or None
                ),
                app_title=settings.openrouter_app_title.strip() or None,
            )
        )
    except VLMError as exc:
        raise RecommendationRuntimeError(str(exc)) from exc


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
                provider_order=tuple(
                    provider.strip()
                    for provider in (
                        settings.openrouter_provider_order.split(",")
                    )
                    if provider.strip()
                ),
                allow_fallbacks=settings.openrouter_allow_fallbacks,
            )
        )
        retriever = CandidateRetriever(index, provider)
    except (CatalogEmbeddingError, VectorIndexError) as exc:
        raise RecommendationRuntimeError(str(exc)) from exc
    image_intent_extractor = None
    if settings.recommendation_image_attributes_enabled:
        image_intent_extractor = VLMImageAttributeExtractor(
            get_vlm_client()
        )
    pairwise_reranker = None
    if settings.recommendation_vlm_rerank_enabled:
        pairwise_reranker = VLMPairwiseCompatibilityModel(
            get_vlm_client(),
            product_image_fetcher=QueryImageFetcher.create(
                settings.recommendation_image_allowed_hosts
            ),
            reasoning_effort=(
                settings.recommendation_vlm_reasoning_effort.strip()
                or None
            ),
        )
    reason_generator = None
    if settings.recommendation_llm_reasons_enabled:
        reason_generator = LLMGroundedReasonGenerator(
            get_vlm_client()
        )
    return RecommendationPipeline(
        retriever,
        image_intent_extractor=image_intent_extractor,
        pairwise_reranker=pairwise_reranker,
        rerank_top_k=settings.recommendation_vlm_rerank_top_k,
        rerank_concurrency=(
            settings.recommendation_vlm_rerank_concurrency
        ),
        reason_generator=reason_generator,
        index_version=index.snapshot_sha256,
    )
