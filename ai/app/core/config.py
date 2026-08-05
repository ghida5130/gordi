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

    # Spring <-> FastAPI 공유 키 (X-Internal-Api-Key 헤더). 추천 호출,
    # try-on 접수 검증, try-on 콜백 발신이 모두 이 키 하나를 쓴다.
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

    # 착장 이미지 생성 — 팀 블라인드 평가 1위는 Nano Banana 2 이고,
    # 그 모델 ID 는 gemini-3.1-flash-image 다. gemini-3-pro-image 는
    # 다른 모델(Nano Banana Pro)이니 혼동 주의.
    tryon_image_model: str = "google/gemini-3.1-flash-image"
    tryon_generation_timeout_seconds: float = Field(
        default=180.0,
        gt=0.0,
        le=600.0,
    )
    tryon_result_dir: Path = AI_ROOT / "tryon_results"
    tryon_result_base_url: str = "http://localhost:8000/try-on-results"
    # 착장 결과 S3 업로드 (운영). 버킷을 지정하면 결과를 S3 에 올리고
    # 공개 base(CloudFront) 조합 URL 을 콜백에 싣는다 — Spring 은 이
    # URL 을 가공 없이 저장·서빙한다. 비우면 로컬 디스크 저장 +
    # /try-on-results 라우트 서빙 (로컬 개발용).
    tryon_s3_bucket: str = ""
    tryon_s3_key_prefix: str = "fittings"
    tryon_result_public_base_url: str = ""
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
    # VLM 판정 호출의 max_tokens 캡. hidden reasoning 토큰이 같은 캡을
    # 소모하므로 effort 를 올리면 캡도 같이 올려야 한다 (medium 이상은
    # 1024+ 권장). 캡이 터지면 판정 실패 → 규칙 점수로 조용히 폴백된다.
    recommendation_vlm_judgment_max_tokens: int = Field(
        default=256,
        ge=64,
        le=8192,
    )
    # 상품 이미지 공개 base URL (예: CloudFront). 설정하면 스냅샷의
    # image_url 값(절대 S3 URL 또는 "garments/..." 객체 키)에서 키를
    # 추출해 이 base 와 조합한다. 비우면 저장된 값을 그대로 쓴다.
    # 백엔드도 같은 방식(base + key)으로 프론트에 조합해 내려준다.
    product_image_base_url: str = ""
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
