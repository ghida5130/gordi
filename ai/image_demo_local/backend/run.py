import uvicorn

from app.core.config import get_settings


if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.image_demo_api_host,
        port=settings.image_demo_api_port,
        reload=settings.image_demo_api_reload,
    )
