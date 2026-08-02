from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.recommendation_demo import page_router
from app.api.internal_router import internal_api_router
from app.api.router import api_router
from app.core.config import get_settings


def create_app() -> FastAPI:
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
    return application


app = create_app()
