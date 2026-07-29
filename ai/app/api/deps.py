from fastapi import Header, HTTPException, status

from app.core.config import get_settings


async def verify_internal_caller(
    x_internal_api_key: str | None = Header(default=None),
) -> None:
    """내부 API 호출자 검증. 키가 설정되지 않은 환경(로컬)에서는 통과시킨다."""
    expected = get_settings().internal_api_key
    if not expected:
        return
    if x_internal_api_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid internal api key",
        )
