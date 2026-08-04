import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.internal_tryon import results_router
from app.api.routes.recommendation_demo import page_router
from app.api.internal_router import internal_api_router
from app.api.router import api_router
from app.core.config import get_settings


def create_app() -> FastAPI:
    # uvicorn 은 자기 로거만 핸들러를 달아 주므로, 앱 로거의 INFO
    # (rerank 지연 관측 등)가 stdout 에 실리도록 루트를 구성한다.
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
    )
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        docs_url="/docs",
        redoc_url="/redoc",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(api_router, prefix=settings.api_prefix)
    application.include_router(internal_api_router)
    application.include_router(page_router)
    application.include_router(results_router)
    # 운영 nginx 가 /ai/ 경로만 프록시하므로 try-on 결과 이미지는
    # API prefix 아래로도 노출한다 (예: /ai/v1/try-on-results/{filename}).
    # 루트 mount 는 로컬·기존 TRYON_RESULT_BASE_URL 호환용으로 유지.
    application.include_router(results_router, prefix=settings.api_prefix)
    return application


app = create_app()
