from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from garment_collector.tpo_tagging import (
    load_tagged_ids,
    parse_tag_answer,
    render_embedding_text,
    tag_dataset_tpo,
)
from tests.test_garment_image_review import build_dataset


class StaticTagClient:
    model = "openai/gpt-5.6-luna"

    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload
        self.calls: list[dict[str, Any]] = []

    def complete_json(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(kwargs)
        return self.payload


GOOD_ANSWER = {
    "occasions": ["OFFICE_CASUAL", "DATE_SOCIAL"],
    "formality": 3,
    "caption": "하객룩이나 오피스룩으로 입기 좋은 단정한 셔츠",
}


def mark_ready(dataset_root: Path) -> None:
    record_path = dataset_root / "normalized" / "musinsa" / "123.json"
    record = json.loads(record_path.read_text(encoding="utf-8"))
    record["images"][0].update(
        {
            "view": "FRONT",
            "reference_type": "product-only",
            "model_present": False,
            "other_garments_present": False,
        }
    )
    record["validation"].update(
        {"status": "READY", "reviewer": "test", "warnings": []}
    )
    record_path.write_text(
        json.dumps(record, ensure_ascii=False), encoding="utf-8"
    )


def test_parse_tag_answer_accepts_valid_payload() -> None:
    fields = parse_tag_answer(
        {
            "occasions": ["office_casual", "OFFICE_CASUAL", "DAILY"],
            "formality": 2,
            "caption": " 매일 입기 좋은 니트 ",
        }
    )

    # 대소문자 정규화 + 중복 제거
    assert fields["occasions"] == ["OFFICE_CASUAL", "DAILY"]
    assert fields["formality"] == 2
    assert fields["caption"] == "매일 입기 좋은 니트"


@pytest.mark.parametrize(
    "payload, match",
    [
        ({"occasions": [], "formality": 2, "caption": "x"}, "non-empty"),
        (
            {"occasions": ["PROM"], "formality": 2, "caption": "x"},
            "vocabulary",
        ),
        (
            {
                "occasions": [
                    "DAILY",
                    "SPORTS",
                    "CEREMONY",
                    "DATE_SOCIAL",
                ],
                "formality": 2,
                "caption": "x",
            },
            "at most",
        ),
        (
            {"occasions": ["DAILY"], "formality": 5, "caption": "x"},
            "out of range",
        ),
        (
            {"occasions": ["DAILY"], "formality": True, "caption": "x"},
            "integer",
        ),
        (
            {"occasions": ["DAILY"], "formality": 2, "caption": "  "},
            "empty",
        ),
        (
            {
                "occasions": ["DAILY"],
                "formality": 2,
                "caption": "가" * 201,
            },
            "too long",
        ),
    ],
)
def test_parse_tag_answer_rejects_invalid(
    payload: dict[str, Any],
    match: str,
) -> None:
    with pytest.raises(ValueError, match=match):
        parse_tag_answer(payload)


def test_render_embedding_text_uses_korean_labels() -> None:
    text = render_embedding_text(
        ["BUSINESS_FORMAL", "CEREMONY"],
        4,
        "격식 자리에 어울리는 셔츠",
    )

    assert "면접·격식 자리" in text
    assert "결혼식 하객·가족 행사" in text
    assert "포멀한 격식 차림" in text
    assert "BUSINESS_FORMAL" not in text


def test_tag_dataset_writes_sidecar_and_is_idempotent(
    tmp_path: Path,
) -> None:
    dataset_root = build_dataset(tmp_path)
    mark_ready(dataset_root)
    output = tmp_path / "tags" / "tpo-tags-v1.jsonl"
    client = StaticTagClient(GOOD_ANSWER)

    first = tag_dataset_tpo(
        dataset_root,
        client,
        output_path=output,
        reasoning_effort="medium",
    )
    second = tag_dataset_tpo(
        dataset_root,
        client,
        output_path=output,
        reasoning_effort="medium",
    )

    assert first.tagged == 1
    assert second.tagged == 0
    assert second.skipped_already_tagged == 1
    assert len(client.calls) == 1
    rows = [
        json.loads(line)
        for line in output.read_text(encoding="utf-8").splitlines()
    ]
    assert len(rows) == 1
    row = rows[0]
    assert row["external_id"] == "123"
    assert row["occasions"] == ["OFFICE_CASUAL", "DATE_SOCIAL"]
    assert row["formality"] == 3
    assert "출근·오피스" in row["embedding_text"]
    assert row["tagger"] == "vlm:openai/gpt-5.6-luna"
    assert row["reasoning_effort"] == "medium"
    assert load_tagged_ids(output) == {"123"}


def test_tag_dataset_rejects_out_of_vocabulary_answer(
    tmp_path: Path,
) -> None:
    dataset_root = build_dataset(tmp_path)
    mark_ready(dataset_root)
    output = tmp_path / "tags.jsonl"
    client = StaticTagClient(
        {"occasions": ["GALA"], "formality": 3, "caption": "x"}
    )

    report = tag_dataset_tpo(
        dataset_root,
        client,
        output_path=output,
    )

    assert report.tagged == 0
    assert report.rejected_answers == 1
    assert not output.exists()


def test_tag_dataset_skips_non_ready_records(tmp_path: Path) -> None:
    dataset_root = build_dataset(tmp_path)  # REVIEW_REQUIRED 상태
    output = tmp_path / "tags.jsonl"
    client = StaticTagClient(GOOD_ANSWER)

    report = tag_dataset_tpo(
        dataset_root,
        client,
        output_path=output,
    )

    assert report.tagged == 0
    assert report.skipped_not_ready == 1
    assert len(client.calls) == 0
