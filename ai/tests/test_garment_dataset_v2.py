from __future__ import annotations

import io
import json
from pathlib import Path

from PIL import Image
import pytest

from garment_collector.adapters.musinsa.parser import (
    parse_goods_detail_payload,
)
from garment_collector.models import BackendSubcategory
from garment_collector.reprocess import reprocess_dataset
from garment_collector.seed_manifest import (
    ManifestError,
    export_seed_manifest,
)


def _detail_payload(*, style_group_id: int = 0) -> dict:
    return {
        "data": {
            "goodsNo": 123,
            "goodsNm": "테스트 반소매 티셔츠",
            "thumbnailImageUrl": "/images/goods_img/20260101/123/123_500.jpg",
            "goodsImages": [
                {"imageUrl": "/images/prd_img/20260101/123/detail_1.jpg"},
                {"imageUrl": "/images/prd_img/20260101/123/detail_2.jpg"},
            ],
            "brandInfo": {"brandName": "테스트브랜드"},
            "sex": ["남성"],
            "category": {
                "categoryDepth1Name": "상의",
                "categoryDepth2Name": "반소매 티셔츠",
            },
            "baseCategoryFullPath": "의류 > 상의 > 반소매 티셔츠",
            "goodsPrice": {"salePrice": 39000, "normalPrice": 49000},
            "similarNo": style_group_id,
            "goodsSaleType": "SALE",
        }
    }


def _actual_size_payload() -> dict:
    return {
        "data": {
            "sizes": [
                {
                    "name": "M",
                    "items": [
                        {"name": "총장", "value": 70.005},
                        {"name": "어깨너비", "value": 48},
                        {"name": "가슴단면", "value": 55},
                    ],
                }
            ]
        }
    }


def _jpeg_bytes() -> bytes:
    output = io.BytesIO()
    Image.new("RGB", (600, 800), "white").save(output, format="JPEG")
    return output.getvalue()


def test_parser_keeps_only_primary_and_preserves_source_labels() -> None:
    parsed = parse_goods_detail_payload(
        "123",
        "https://www.musinsa.com/products/123",
        _detail_payload(),
        actual_size_payload=_actual_size_payload(),
    )

    assert parsed.image_urls == [
        "https://image.msscdn.net/thumbnails/images/goods_img/"
        "20260101/123/123_big.jpg?w=1200"
    ]
    assert parsed.category == "상의"
    assert parsed.subcategory == "반소매 티셔츠"
    assert parsed.backend_subcategory == BackendSubcategory.SHORT_SLEEVE
    assert parsed.style_group_id is None


def test_reprocess_creates_one_unknown_primary_and_canonical_raw_hash(
    tmp_path: Path,
) -> None:
    source_root = tmp_path / "source"
    output_root = tmp_path / "output"
    raw_dir = source_root / "raw" / "musinsa" / "123"
    image_dir = source_root / "images" / "musinsa" / "123"
    normalized_dir = source_root / "normalized" / "musinsa"
    raw_dir.mkdir(parents=True)
    image_dir.mkdir(parents=True)
    normalized_dir.mkdir(parents=True)

    bundle = {
        "detail": _detail_payload(),
        "actual_size": _actual_size_payload(),
        "options": None,
    }
    (raw_dir / "source.json").write_text(
        json.dumps(bundle, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (image_dir / "primary.jpg").write_bytes(_jpeg_bytes())
    old_record = {
        "source": {
            "product_url": "https://www.musinsa.com/products/123",
            "collection_method": "public-html-slow-fetch",
            "collected_at": "2026-07-30T00:00:00+09:00",
            "last_seen_at": "2026-07-30T00:00:00+09:00",
            "rights_status": "internal-evaluation-only-unverified",
            "policy_exception": "mvp-internal-eval-v1",
            "robots_txt_note": "internal evaluation",
        },
        "product": {},
        "images": [
            {
                "role": "PRIMARY",
                "local_path": "images/musinsa/123/primary.jpg",
                "source_url": "https://example.invalid/primary.jpg",
            }
        ],
    }
    (normalized_dir / "123.json").write_text(
        json.dumps(old_record, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    summary = reprocess_dataset(source_root, output_root)
    record = json.loads(
        (output_root / "normalized" / "musinsa" / "123.json").read_text(
            encoding="utf-8"
        )
    )

    assert summary["normalized_count"] == 1
    assert summary["primary_image_count"] == 1
    assert summary["alternate_image_count"] == 0
    assert summary["orphan_image_count"] == 0
    assert len(record["images"]) == 1
    assert record["images"][0]["view"] == "UNKNOWN"
    assert record["images"][0]["reference_type"] == "unknown"
    assert record["images"][0]["model_present"] is None
    assert record["validation"]["status"] == "REVIEW_REQUIRED"
    assert len(record["source"]["raw_bundle_sha256"]) == 64


def test_export_seed_requires_ready_and_rounds_half_up(
    tmp_path: Path,
) -> None:
    source_root = tmp_path / "source"
    dataset_root = tmp_path / "dataset-v2"
    raw_dir = source_root / "raw" / "musinsa" / "123"
    image_dir = source_root / "images" / "musinsa" / "123"
    normalized_dir = source_root / "normalized" / "musinsa"
    raw_dir.mkdir(parents=True)
    image_dir.mkdir(parents=True)
    normalized_dir.mkdir(parents=True)
    bundle = {
        "detail": _detail_payload(),
        "actual_size": _actual_size_payload(),
        "options": None,
    }
    (raw_dir / "source.json").write_text(
        json.dumps(bundle, ensure_ascii=False),
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
                    "rights_status": "internal-evaluation-only-unverified",
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
    selection = tmp_path / "selection.json"
    selection.write_text(
        json.dumps({"ids": {"MALE/TOP": ["123"]}}),
        encoding="utf-8",
    )
    output = tmp_path / "seed.json"

    with pytest.raises(ManifestError, match="status must be READY"):
        export_seed_manifest(
            dataset_root,
            selection,
            output,
            expected_group_counts={"MALE/TOP": 1},
            expected_size_rows=1,
        )
    assert not output.exists()

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
        {"status": "READY", "reviewer": "test-reviewer", "warnings": []}
    )
    record_path.write_text(
        json.dumps(record, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    manifest = export_seed_manifest(
        dataset_root,
        selection,
        output,
        expected_group_counts={"MALE/TOP": 1},
        expected_size_rows=1,
    )

    assert manifest["product_count"] == 1
    assert manifest["size_row_count"] == 1
    assert manifest["products"][0]["source"] == "MUSINSA"
    assert manifest["products"][0]["external_id"] == "123"
    assert (
        manifest["products"][0]["sizes"][0]["measurements_cm"]["total_length"]
        == "70.01"
    )
    assert output.is_file()
