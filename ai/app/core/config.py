from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

MONOREPO_ROOT = Path(__file__).resolve().parents[3]
AI_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=MONOREPO_ROOT / ".env",
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
