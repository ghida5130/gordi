from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

MONOREPO_ROOT = Path(__file__).resolve().parents[3]
AI_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    # AI 환경변수는 ai/.env 에서 관리한다 (팀 결정: 파트별 env 분리).
    # 루트 .env 는 공유 값(INTERNAL_API_KEY 등)의 전환기 fallback 이며,
    # 같은 키가 양쪽에 있으면 ai/.env 가 이긴다.
    model_config = SettingsConfigDict(
        env_file=(MONOREPO_ROOT / ".env", AI_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Gordi AI API"
    app_version: str = "0.1.0"
    environment: str = "local"
    api_prefix: str = "/api/v1"

    ai_host: str = "0.0.0.0"
    ai_port: int = 8000
    ai_reload: bool = True

    internal_api_key: str = ""
    # Spring <-> FastAPI 내부 토큰 (try-on 접수 검증 + 콜백 헤더 공용)
    internal_token: str = ""

    openrouter_api_key: str = ""
    openrouter_embedding_model: str = "google/gemini-embedding-2"
    openrouter_embedding_dimensions: int = Field(
        default=768,
        ge=128,
        le=3072,
    )
    openrouter_embedding_endpoint: str = (
        "https://openrouter.ai/api/v1/embeddings"
    )
    openrouter_http_referer: str = ""
    openrouter_app_title: str = "Gordi AI"
    openrouter_provider_order: str = "google-vertex"
    openrouter_allow_fallbacks: bool = False
    recommendation_vlm_model: str = "openai/gpt-5.6-luna"
    recommendation_vlm_endpoint: str = (
        "https://openrouter.ai/api/v1/chat/completions"
    )
    recommendation_vlm_api_key: str = ""
    recommendation_vlm_timeout_seconds: float = Field(
        default=20.0,
        gt=0.0,
        le=120.0,
    )
    recommendation_image_attributes_enabled: bool = False
    recommendation_vlm_rerank_enabled: bool = False
    recommendation_llm_reasons_enabled: bool = False
    # /rank 를 벡터 파이프라인으로 처리 (인덱스/키 불가 시 baseline fallback)
    recommendation_rank_vector_enabled: bool = True

    # 착장 이미지 생성 (Nano Banana 2 = gemini-3-pro-image, 팀 블라인드 평가 1위)
    tryon_image_model: str = "google/gemini-3-pro-image"
    tryon_generation_timeout_seconds: float = Field(
        default=180.0,
        gt=0.0,
        le=600.0,
    )
    tryon_result_dir: Path = AI_ROOT / "tryon_results"
    tryon_result_base_url: str = "http://localhost:8000/try-on-results"
    spring_internal_base_url: str = "http://localhost:8080"
    recommendation_vlm_rerank_top_k: int = Field(
        default=20,
        ge=1,
        le=50,
    )
    recommendation_vlm_rerank_concurrency: int = Field(
        default=8,
        ge=1,
        le=32,
    )
    # 기본 모델(gpt-5.6-luna 등 OpenAI reasoning 계열)은 low가 필요하고,
    # Gemma처럼 reasoning 필드를 거부하는 모델은 빈 값으로 둔다.
    recommendation_vlm_reasoning_effort: str = "low"
    catalog_embedding_index_path: Path = (
        AI_ROOT / "catalog_index" / "catalog-embeddings.json"
    )
    recommendation_image_allowed_hosts: list[str] = Field(
        default_factory=list
    )
    enable_recommendation_demo: bool = False
    recommendation_demo_dataset_root: Path | None = None

    cors_allowed_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173"]
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
