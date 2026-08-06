from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

IMAGE_DEMO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=IMAGE_DEMO_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Gordi Image Model Evaluation Demo"
    app_version: str = "0.1.0"
    api_prefix: str = "/api/v1"

    image_demo_api_host: str = "127.0.0.1"
    image_demo_api_port: int = 8100
    image_demo_api_reload: bool = False

    demo_data_dir: Path = IMAGE_DEMO_ROOT / "backend" / "demo_data"
    demo_test_data_dir: Path = IMAGE_DEMO_ROOT / "test_data"
    demo_max_upload_mb: int = 10
    image_provider_timeout_seconds: float = 120.0

    openrouter_api_key: str | None = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_http_referer: str | None = None
    openrouter_app_title: str = "Gordi Image Model Evaluation Demo"
    openrouter_nano_banana_model: str = "google/gemini-3.1-flash-image"
    openrouter_nano_banana_lite_model: str = "google/gemini-3.1-flash-lite-image"
    openrouter_gpt_image_model: str = "openai/gpt-image-2"
    openrouter_grok_imagine_quality_model: str = "x-ai/grok-imagine-image-quality"
    openrouter_krea_medium_model: str = "krea/krea-2-medium"
    openrouter_flux_max_model: str = "black-forest-labs/flux.2-max"
    openrouter_mai_pro_model: str = "microsoft/mai-image-2.5"

    flux_klein_endpoint: str | None = None
    flux_klein_api_key: str | None = None
    flux_klein_model: str = "FLUX.2-klein-9B-Base"
    flux_klein_lora_path: str | None = None
    flux_klein_lora_scale: float = 1.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
