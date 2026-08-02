from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from garment_collector.image_review import (
    ImageReviewError,
    parse_review_answer,
    review_dataset_images,
)
from garment_collector.models import ImageView, ReferenceType
from garment_collector.reprocess import reprocess_dataset
from tests.test_garment_dataset_v2 import (
    _actual_size_payload,
    _detail_payload,
    _jpeg_bytes,
)


def build_dataset(tmp_path: Path) -> Path:
    """Build one REVIEW_REQUIRED v2 record via the reprocess fixture."""
    source_root = tmp_path / "source"
    dataset_root = tmp_path / "dataset-v2"
    raw_dir = source_root / "raw" / "musinsa" / "123"
    image_dir = source_root / "images" / "musinsa" / "123"
    normalized_dir = source_root / "normalized" / "musinsa"
    raw_dir.mkdir(parents=True)
    image_dir.mkdir(parents=True)
    normalized_dir.mkdir(parents=True)
    (raw_dir / "source.json").write_text(
        json.dumps(
            {
                "detail": _detail_payload(),
                "actual_size": _actual_size_payload(),
                "options": None,
            }
        ),
        encoding="utf-8",
    )
    (image_dir / "primary.jpg").write_bytes(_jpeg_bytes())
    (normalized_dir / "123.json").write_text(
        json.dumps(
            {
                "source": {
                    "product_url": "https://www.musinsa.com/products/123",
                    "collection_method": "public-html-slow-fetch",
                    "collected_at": "2026-07-30T00:00:00+09:00",
                    "last_seen_at": "2026-07-30T00:00:00+09:00",
                    "rights_status": (
                        "internal-evaluation-only-unverified"
                    ),
                    "policy_exception": "mvp-internal-eval-v1",
                },
                "product": {},
                "images": [
                    {
                        "role": "PRIMARY",
                        "local_path": "images/musinsa/123/primary.jpg",
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    reprocess_dataset(source_root, dataset_root)
    return dataset_root


class StaticVLMClient:
    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload
        self.calls = 0

    def complete_json(
        self,
        *,
        system: str,
        user_parts: list[dict[str, Any]],
        max_tokens: int | None = None,
        reasoning_effort: str | None = None,
    ) -> dict[str, Any]:
        self.calls += 1
        assert user_parts[0]["type"] == "image_url"
        return self.payload


def test_parse_review_answer_normalizes_and_validates() -> None:
    fields = parse_review_answer(
        {
            "view": "front",
            "reference_type": "PRODUCT-ONLY",
            "model_present": False,
            "other_garments_present": False,
        }
    )

    assert fields["view"] is ImageView.FRONT
    assert fields["reference_type"] is ReferenceType.PRODUCT_ONLY


@pytest.mark.parametrize(
    "payload",
    [
        {"view": "TOP-DOWN", "reference_type": "product-only",
         "model_present": False, "other_garments_present": False},
        {"view": "FRONT", "reference_type": "unknown",
         "model_present": False, "other_garments_present": False},
        {"view": "FRONT", "reference_type": "product-only",
         "model_present": "no", "other_garments_present": False},
        {"view": "FRONT", "reference_type": "product-only",
         "model_present": False},
    ],
)
def test_parse_review_answer_rejects_out_of_vocabulary(
    payload: dict[str, Any],
) -> None:
    with pytest.raises(ValueError):
        parse_review_answer(payload)


def test_review_promotes_clean_record_to_ready(tmp_path: Path) -> None:
    dataset_root = build_dataset(tmp_path)
    client = StaticVLMClient(
        {
            "view": "FRONT",
            "reference_type": "product-only",
            "model_present": False,
            "other_garments_present": False,
        }
    )

    report = review_dataset_images(
        dataset_root,
        client,
        reviewer="vlm:test-model",
        concurrency=2,
    )

    assert client.calls == 1
    assert report.reviewed == 1
    assert report.ready == 1
    assert report.failed == 0
    record = json.loads(
        (dataset_root / "normalized" / "musinsa" / "123.json").read_text(
            encoding="utf-8"
        )
    )
    assert record["validation"]["status"] == "READY"
    assert record["validation"]["reviewer"] == "vlm:test-model"
    assert record["images"][0]["view"] == "FRONT"
    assert record["images"][0]["reference_type"] == "product-only"
    assert record["images"][0]["model_present"] is False
    summary_path = dataset_root / "reports" / "image-review-summary.json"
    assert summary_path.is_file()


def test_review_rejected_answer_leaves_record_untouched(
    tmp_path: Path,
) -> None:
    dataset_root = build_dataset(tmp_path)
    client = StaticVLMClient(
        {
            "view": "HOVERING",
            "reference_type": "product-only",
            "model_present": False,
            "other_garments_present": False,
        }
    )

    report = review_dataset_images(
        dataset_root,
        client,
        reviewer="vlm:test-model",
    )

    assert report.rejected_answers == 1
    assert report.ready == 0
    record = json.loads(
        (dataset_root / "normalized" / "musinsa" / "123.json").read_text(
            encoding="utf-8"
        )
    )
    assert record["validation"]["status"] == "REVIEW_REQUIRED"
    assert record["images"][0]["view"] == "UNKNOWN"


def test_review_dry_run_counts_without_calls(tmp_path: Path) -> None:
    dataset_root = build_dataset(tmp_path)
    client = StaticVLMClient({})

    report = review_dataset_images(
        dataset_root,
        client,
        reviewer="vlm:test-model",
        dry_run=True,
    )

    assert client.calls == 0
    assert report.scanned == 1
    assert report.reviewed == 0


def test_review_skips_already_reviewed_records(tmp_path: Path) -> None:
    dataset_root = build_dataset(tmp_path)
    good = StaticVLMClient(
        {
            "view": "FRONT",
            "reference_type": "worn-reference",
            "model_present": True,
            "other_garments_present": True,
        }
    )
    review_dataset_images(dataset_root, good, reviewer="vlm:test-model")

    second = StaticVLMClient({})
    report = review_dataset_images(
        dataset_root,
        second,
        reviewer="vlm:test-model",
    )

    assert second.calls == 0
    assert report.skipped_not_target == 1


def test_review_rejects_bad_concurrency(tmp_path: Path) -> None:
    dataset_root = build_dataset(tmp_path)

    with pytest.raises(ImageReviewError, match="concurrency"):
        review_dataset_images(
            dataset_root,
            StaticVLMClient({}),
            reviewer="vlm:test-model",
            concurrency=0,
        )
