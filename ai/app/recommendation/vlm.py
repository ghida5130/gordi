"""OpenAI-compatible chat-completions client for VLM/LLM features.

One client covers both deployment options the team is considering:

- hosted: OpenRouter chat completions with a fast commercial vision
  model (default ``openai/gpt-5.6-luna``)
- local: any OpenAI-compatible server (Ollama, vLLM, LM Studio) by
  pointing ``endpoint`` at it; ``api_key`` may then be empty

All recommendation VLM features (query-image attribute extraction,
pairwise compatibility scoring, grounded reason generation) go through
this client so the provider can be swapped with configuration only.
"""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from typing import Any

import httpx

DEFAULT_VLM_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_VLM_MODEL = "openai/gpt-5.6-luna"
_ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png"}


class VLMError(RuntimeError):
    """Raised when a VLM request fails or returns an unusable answer."""


@dataclass(frozen=True)
class VLMSettings:
    model: str = DEFAULT_VLM_MODEL
    endpoint: str = DEFAULT_VLM_ENDPOINT
    api_key: str = ""
    timeout_seconds: float = 20.0
    max_output_tokens: int = 512
    temperature: float = 0.0
    http_referer: str | None = None
    app_title: str | None = None

    def validate(self) -> None:
        if not self.model.strip():
            raise VLMError("VLM model must not be empty")
        url = httpx.URL(self.endpoint)
        if url.scheme not in {"http", "https"} or not url.host:
            raise VLMError("VLM endpoint must be an HTTP(S) URL")
        if self.timeout_seconds <= 0:
            raise VLMError("VLM timeout must be positive")
        if self.max_output_tokens <= 0:
            raise VLMError("VLM max_output_tokens must be positive")


def text_part(text: str) -> dict[str, Any]:
    return {"type": "text", "text": text}


def image_part(image: bytes, mime_type: str) -> dict[str, Any]:
    if mime_type not in _ALLOWED_IMAGE_MIME_TYPES:
        raise VLMError("VLM image must be JPEG or PNG")
    encoded = base64.b64encode(image).decode("ascii")
    return {
        "type": "image_url",
        "image_url": {"url": f"data:{mime_type};base64,{encoded}"},
    }


class OpenAICompatibleVLMClient:
    def __init__(
        self,
        settings: VLMSettings,
        *,
        client: httpx.Client | None = None,
    ) -> None:
        settings.validate()
        self._settings = settings
        self._headers = {"Content-Type": "application/json"}
        if settings.api_key.strip():
            self._headers["Authorization"] = (
                f"Bearer {settings.api_key}"
            )
        if settings.http_referer:
            self._headers["HTTP-Referer"] = settings.http_referer
        if settings.app_title:
            self._headers["X-Title"] = settings.app_title
        self._client = client or httpx.Client(
            timeout=settings.timeout_seconds
        )
        self._owns_client = client is None

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> "OpenAICompatibleVLMClient":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def complete_text(
        self,
        *,
        system: str,
        user_parts: list[dict[str, Any]],
        max_tokens: int | None = None,
        reasoning_effort: str | None = None,
    ) -> str:
        if max_tokens is not None and max_tokens <= 0:
            raise VLMError("max_tokens override must be positive")
        if reasoning_effort is not None and reasoning_effort not in {
            "minimal",
            "low",
            "medium",
            "high",
        }:
            raise VLMError(
                "reasoning_effort must be minimal, low, medium, or high"
            )
        payload: dict[str, Any] = {
            "model": self._settings.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user_parts},
            ],
            "max_tokens": (
                max_tokens
                if max_tokens is not None
                else self._settings.max_output_tokens
            ),
            "temperature": self._settings.temperature,
        }
        if reasoning_effort is not None:
            # OpenRouter normalizes this across reasoning models and
            # ignores it elsewhere; reasoning tokens count against
            # max_tokens, so judgments must keep the effort bounded.
            payload["reasoning"] = {"effort": reasoning_effort}
        try:
            response = self._client.post(
                self._settings.endpoint,
                headers=self._headers,
                json=payload,
            )
        except httpx.HTTPError as exc:
            raise VLMError(
                f"VLM request failed: {type(exc).__name__}"
            ) from exc
        if not response.is_success:
            raise VLMError(
                f"VLM request failed with status {response.status_code}"
            )
        try:
            body = response.json()
        except ValueError as exc:
            # filler-only 응답(212초 행 사건)인지, HTML 에러 페이지인지,
            # 잘린 JSON인지 로그만으로 구분할 수 있어야 한다.
            snippet = response.text[:120]
            raise VLMError(
                "VLM returned a non-JSON response "
                f"(status {response.status_code}, "
                f"{len(response.content)} bytes, "
                f"snippet {snippet!r})"
            ) from exc
        try:
            content = body["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise VLMError(
                "VLM response has no message content"
            ) from exc
        if not isinstance(content, str) or not content.strip():
            raise VLMError("VLM returned empty message content")
        return content

    def complete_json(
        self,
        *,
        system: str,
        user_parts: list[dict[str, Any]],
        max_tokens: int | None = None,
        reasoning_effort: str | None = None,
    ) -> dict[str, Any]:
        content = self.complete_text(
            system=system,
            user_parts=user_parts,
            max_tokens=max_tokens,
            reasoning_effort=reasoning_effort,
        )
        parsed = _parse_json_object(content)
        if parsed is None:
            raise VLMError("VLM did not return a JSON object")
        return parsed


def _parse_json_object(content: str) -> dict[str, Any] | None:
    stripped = content.strip()
    if stripped.startswith("```"):
        first_newline = stripped.find("\n")
        closing = stripped.rfind("```")
        if first_newline != -1 and closing > first_newline:
            stripped = stripped[first_newline + 1 : closing].strip()
    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, dict):
        return None
    return parsed


__all__ = [
    "DEFAULT_VLM_ENDPOINT",
    "DEFAULT_VLM_MODEL",
    "OpenAICompatibleVLMClient",
    "VLMError",
    "VLMSettings",
    "image_part",
    "text_part",
]
