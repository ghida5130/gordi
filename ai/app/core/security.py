import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from app.core.config import Settings, get_settings


def verify_internal_api_key(
    x_internal_api_key: Annotated[
        str | None,
        Header(alias="X-Internal-Api-Key"),
    ] = None,
    settings: Settings = Depends(get_settings),
) -> None:
    expected_key = settings.internal_api_key.strip()
    if not expected_key:
        return

    provided_key = (x_internal_api_key or "").strip()
    if not provided_key or not secrets.compare_digest(provided_key, expected_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key.",
        )
