from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    settings.demo_data_dir.mkdir(parents=True, exist_ok=True)
    settings.demo_test_data_dir.mkdir(parents=True, exist_ok=True)
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        docs_url="/docs",
        redoc_url="/redoc",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5174",
            "http://127.0.0.1:5174",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(api_router, prefix=settings.api_prefix)
    application.mount(
        "/demo-media",
        StaticFiles(directory=settings.demo_data_dir),
        name="demo-media",
    )
    application.mount(
        "/test-data",
        StaticFiles(directory=settings.demo_test_data_dir),
        name="test-data",
    )
    return application


app = create_app()
