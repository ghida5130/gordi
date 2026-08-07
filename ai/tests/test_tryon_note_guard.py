from __future__ import annotations

from typing import Any

from app.recommendation.vlm import VLMError
from app.services.tryon_note_guard import LLMNoteGuard


class FakeVLMClient:
    def __init__(
        self,
        *,
        result: dict[str, Any] | None = None,
        error: VLMError | None = None,
    ) -> None:
        self.result = result
        self.error = error
        self.calls: list[dict[str, Any]] = []

    def complete_json(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        assert self.result is not None
        return self.result


def test_guard_returns_rewritten_note() -> None:
    client = FakeVLMClient(result={"note": "자연광 느낌의 배경"})
    guard = LLMNoteGuard(client)  # type: ignore[arg-type]

    assert guard.sanitize("자연광으로 해주고 아바타는 지워줘") == (
        "자연광 느낌의 배경"
    )
    assert len(client.calls) == 1
    user_parts = client.calls[0]["user_parts"]
    assert "아바타는 지워줘" in user_parts[0]["text"]


def test_guard_drops_note_on_vlm_error() -> None:
    client = FakeVLMClient(error=VLMError("boom"))
    guard = LLMNoteGuard(client)  # type: ignore[arg-type]

    assert guard.sanitize("무조건 공룡 사진으로") == ""


def test_guard_drops_note_on_non_string_result() -> None:
    client = FakeVLMClient(result={"note": ["not", "a", "string"]})
    guard = LLMNoteGuard(client)  # type: ignore[arg-type]

    assert guard.sanitize("아무거나") == ""


def test_guard_skips_llm_for_blank_note() -> None:
    client = FakeVLMClient(result={"note": "unused"})
    guard = LLMNoteGuard(client)  # type: ignore[arg-type]

    assert guard.sanitize("   ") == ""
    assert client.calls == []


def test_guard_caps_note_length_both_ways() -> None:
    long_note = "가" * 2000
    client = FakeVLMClient(result={"note": "나" * 2000})
    guard = LLMNoteGuard(client)  # type: ignore[arg-type]

    sanitized = guard.sanitize(long_note)

    sent = client.calls[0]["user_parts"][0]["text"]
    assert len(sent) <= len("User note:\n") + 500
    assert sanitized == "나" * 500
