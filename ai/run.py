import uvicorn

from app.core.config import get_settings


if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.ai_host,
        port=settings.ai_port,
        reload=settings.ai_reload,
    )
