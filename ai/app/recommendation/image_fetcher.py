"""Fetch recommendation query images from an explicit URL allowlist."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit

import httpx

from app.recommendation.catalog_embeddings import (
    MAX_IMAGE_BYTES,
    CatalogEmbeddingError,
    ResolvedImage,
    detect_image_mime,
)

_REDIRECT_STATUSES = {301, 302, 303, 307, 308}
_MAX_REDIRECTS = 3


class QueryImageError(RuntimeError):
    """Raised when a query image URL or response is unsafe or invalid.

    ``retryable`` separates transient failures (network errors that may
    pass on retry) from permanent ones — URL/host validation and content
    rules fail identically every retry, so they default to ``False``.
    """

    def __init__(self, message: str, *, retryable: bool = False) -> None:
        super().__init__(message)
        self.retryable = retryable


@dataclass(frozen=True)
class QueryImageFetcher:
    allowed_hosts: frozenset[str]
    _client: httpx.Client
    _owns_client: bool

    @classmethod
    def create(
        cls,
        allowed_hosts: list[str],
        *,
        client: httpx.Client | None = None,
        timeout_seconds: float = 10.0,
    ) -> "QueryImageFetcher":
        normalized_hosts = frozenset(
            host.strip().casefold()
            for host in allowed_hosts
            if host.strip()
        )
        return cls(
            allowed_hosts=normalized_hosts,
            _client=client
            or httpx.Client(
                timeout=timeout_seconds,
                follow_redirects=False,
            ),
            _owns_client=client is None,
        )

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def fetch(self, url: str) -> ResolvedImage:
        current_url = url
        for redirect_count in range(_MAX_REDIRECTS + 1):
            self._validate_url(current_url)
            try:
                with self._client.stream("GET", current_url) as response:
                    if response.status_code in _REDIRECT_STATUSES:
                        location = response.headers.get("location")
                        if not location:
                            raise QueryImageError(
                                "query image redirect has no location"
                            )
                        if redirect_count == _MAX_REDIRECTS:
                            raise QueryImageError(
                                "query image exceeded redirect limit"
                            )
                        current_url = urljoin(current_url, location)
                        continue
                    response.raise_for_status()
                    content_length = response.headers.get("content-length")
                    if (
                        content_length is not None
                        and int(content_length) > MAX_IMAGE_BYTES
                    ):
                        raise QueryImageError(
                            "query image exceeds size limit"
                        )
                    content = bytearray()
                    for chunk in response.iter_bytes():
                        content.extend(chunk)
                        if len(content) > MAX_IMAGE_BYTES:
                            raise QueryImageError(
                                "query image exceeds size limit"
                            )
            except QueryImageError:
                raise
            except (httpx.HTTPError, ValueError) as exc:
                raise QueryImageError(
                    f"query image fetch failed: {exc}",
                    retryable=True,
                ) from exc
            image = bytes(content)
            if not image:
                raise QueryImageError("query image is empty")
            try:
                mime_type = detect_image_mime(
                    image,
                    context="query image",
                )
            except CatalogEmbeddingError as exc:
                raise QueryImageError(str(exc)) from exc
            return ResolvedImage(
                content=image,
                mime_type=mime_type,
                sha256=hashlib.sha256(image).hexdigest(),
            )
        raise QueryImageError("query image redirect handling failed")

    def _validate_url(self, url: str) -> None:
        parsed = urlsplit(url)
        if parsed.scheme not in {"http", "https"}:
            raise QueryImageError(
                "query image URL must use http or https"
            )
        if parsed.username is not None or parsed.password is not None:
            raise QueryImageError(
                "query image URL credentials are not allowed"
            )
        hostname = (parsed.hostname or "").casefold()
        if not hostname or hostname not in self.allowed_hosts:
            raise QueryImageError(
                f"query image host is not allowed: {hostname or 'missing'}"
            )
