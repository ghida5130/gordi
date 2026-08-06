"""Lazy runtime assembly of the multimodal recommendation pipeline."""

from __future__ import annotations

import threading
import time
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
def get_pairwise_reranker() -> VLMPairwiseCompatibilityModel:
    """Shared VLM pairwise reranker for `/search` and `/rank`.

    Long-lived by design: the underlying image fetcher keeps its HTTP
    session for the process lifetime, same as the pipeline runtime.
    """
    settings = get_settings()
    return VLMPairwiseCompatibilityModel(
        get_vlm_client(),
        product_image_fetcher=QueryImageFetcher.create(
            settings.recommendation_image_allowed_hosts
        ),
        reasoning_effort=(
            settings.recommendation_vlm_reasoning_effort.strip()
            or None
        ),
        image_base_url=settings.product_image_base_url,
        judgment_max_tokens=(
            settings.recommendation_vlm_judgment_max_tokens
        ),
    )


# lru_cache 는 예외를 캐시하지 않아서, 스냅샷 로드 실패가 요청마다
# 수백 MB JSON 재파싱을 유발해 응답 지연 → 호출자(Spring) 타임아웃으로
# 번진다 (2026-08-06 EC2 장애). 실패도 backoff 동안 기억해 즉시
# baseline 으로 강등되게 한다.
_INDEX_FAILURE_BACKOFF_SECONDS = 60.0
_index_failure: tuple[float, str] | None = None
_index_failure_lock = threading.Lock()


@lru_cache
def _load_catalog_index() -> CatalogVectorIndex:
    settings = get_settings()
    return CatalogVectorIndex.load(
        settings.catalog_embedding_index_path
    )


def get_catalog_index() -> CatalogVectorIndex:
    global _index_failure
    with _index_failure_lock:
        if _index_failure is not None:
            failed_at, message = _index_failure
            if (
                time.monotonic() - failed_at
                < _INDEX_FAILURE_BACKOFF_SECONDS
            ):
                raise RecommendationRuntimeError(message)
            _index_failure = None
    try:
        return _load_catalog_index()
    except VectorIndexError as exc:
        with _index_failure_lock:
            _index_failure = (time.monotonic(), str(exc))
        raise RecommendationRuntimeError(str(exc)) from exc


@lru_cache
def get_embedding_provider() -> OpenRouterEmbeddingProvider:
    settings = get_settings()
    if not settings.openrouter_api_key.strip():
        raise RecommendationRuntimeError(
            "OPENROUTER_API_KEY is not configured"
        )
    try:
        return OpenRouterEmbeddingProvider(
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
    except CatalogEmbeddingError as exc:
        raise RecommendationRuntimeError(str(exc)) from exc


@lru_cache
def get_recommendation_pipeline() -> RecommendationPipeline:
    settings = get_settings()
    try:
        index = get_catalog_index()
        provider = get_embedding_provider()
        retriever = CandidateRetriever(index, provider)
    except (
        CatalogEmbeddingError,
        VectorIndexError,
    ) as exc:
        raise RecommendationRuntimeError(str(exc)) from exc
    image_intent_extractor = None
    if settings.recommendation_image_attributes_enabled:
        image_intent_extractor = VLMImageAttributeExtractor(
            get_vlm_client()
        )
    pairwise_reranker = None
    if settings.recommendation_vlm_rerank_enabled:
        pairwise_reranker = get_pairwise_reranker()
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


@lru_cache
def get_ab_pipeline(rerank_enabled: bool) -> RecommendationPipeline:
    """VLM opt-in A/B 데모용 파이프라인 쌍.

    로컬 env 플래그와 무관하게 rerank 유무만 다른 두 인스턴스를
    만든다 — ON 팔은 VLM 런타임이 없으면 명시적으로 실패해야
    비교가 성립한다 (조용한 강등 금지).
    """
    settings = get_settings()
    try:
        index = get_catalog_index()
        provider = get_embedding_provider()
        retriever = CandidateRetriever(index, provider)
    except (
        CatalogEmbeddingError,
        VectorIndexError,
    ) as exc:
        raise RecommendationRuntimeError(str(exc)) from exc
    return RecommendationPipeline(
        retriever,
        pairwise_reranker=(
            get_pairwise_reranker() if rerank_enabled else None
        ),
        rerank_top_k=settings.recommendation_vlm_rerank_top_k,
        rerank_concurrency=(
            settings.recommendation_vlm_rerank_concurrency
        ),
        index_version=index.snapshot_sha256,
    )
