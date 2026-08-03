"""HTTP client that stops on bot-block signals (no bypass)."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from garment_collector.config import STOP_HTTP_STATUSES, CollectorSettings
from garment_collector.rate_limit import RateLimiter

logger = logging.getLogger(__name__)


class CollectionStopped(RuntimeError):
    """Raised when the source blocks or rate-limits the collector."""


@dataclass
class FetchResult:
    url: str
    status_code: int
    content: bytes
    content_type: str | None
    final_url: str


class SlowHttpClient:
    def __init__(
        self,
        settings: CollectorSettings,
        delay_sec: float,
        *,
        stop_on_block: bool = True,
    ) -> None:
        self._settings = settings
        self._stop_on_block = stop_on_block
        self._limiter = RateLimiter(delay_sec)
        self._client = httpx.Client(
            headers={
                "User-Agent": settings.user_agent,
                "Accept": "text/html,application/json,image/*,*/*;q=0.8",
                "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
            },
            follow_redirects=True,
            timeout=httpx.Timeout(30.0, connect=10.0),
        )
        self.stopped = False
        self.stop_reason: str | None = None

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> SlowHttpClient:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    def get(self, url: str) -> FetchResult:
        if self.stopped:
            raise CollectionStopped(self.stop_reason or "collection already stopped")

        last_error: Exception | None = None
        for attempt in range(self._settings.max_retries + 1):
            self._limiter.wait()
            try:
                response = self._client.get(url)
            except httpx.HTTPError as exc:
                last_error = exc
                logger.warning("HTTP error url=%s attempt=%s err=%s", url, attempt, exc)
                continue

            if response.status_code in STOP_HTTP_STATUSES:
                if self._stop_on_block:
                    self.stopped = True
                    self.stop_reason = (
                        f"stop status {response.status_code} for {url} "
                        "(policy: no bypass)"
                    )
                    logger.error(self.stop_reason)
                    raise CollectionStopped(self.stop_reason)
                # Asset hosts (brand CDNs): treat as hard client error, do not
                # abort the whole collection run.
                raise httpx.HTTPStatusError(
                    f"client error {response.status_code}",
                    request=response.request,
                    response=response,
                )

            if self._looks_like_block_page(response):
                if self._stop_on_block:
                    self.stopped = True
                    self.stop_reason = f"block/captcha page detected for {url}"
                    logger.error(self.stop_reason)
                    raise CollectionStopped(self.stop_reason)
                raise httpx.HTTPStatusError(
                    "block/captcha page on asset host",
                    request=response.request,
                    response=response,
                )

            if response.status_code >= 500:
                last_error = httpx.HTTPStatusError(
                    f"server error {response.status_code}",
                    request=response.request,
                    response=response,
                )
                logger.warning(
                    "server error url=%s status=%s attempt=%s",
                    url,
                    response.status_code,
                    attempt,
                )
                continue

            if response.status_code >= 400:
                raise httpx.HTTPStatusError(
                    f"client error {response.status_code}",
                    request=response.request,
                    response=response,
                )

            return FetchResult(
                url=url,
                status_code=response.status_code,
                content=response.content,
                content_type=response.headers.get("content-type"),
                final_url=str(response.url),
            )

        raise RuntimeError(f"failed to fetch {url}: {last_error}")

    @staticmethod
    def _looks_like_block_page(response: httpx.Response) -> bool:
        content_type = (response.headers.get("content-type") or "").lower()
        if "text/html" not in content_type:
            return False
        text = response.text[:8000].lower()
        markers = (
            "captcha",
            "access denied",
            "bot detection",
            "unusual traffic",
            "자동화",
            "비정상적인 접근",
            "차단되었습니다",
        )
        return any(marker in text for marker in markers)
