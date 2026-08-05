"""Strict export of manually reviewed garments for backend seeding."""

from __future__ import annotations

import json
from collections import Counter
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any

from garment_collector import SCHEMA_VERSION
from garment_collector.images import inspect_image
from garment_collector.models import (
    BackendCategory,
    GarmentRecord,
    ImageView,
    ReferenceType,
    ValidationStatus,
)
from garment_collector.storage import DatasetStorage

MANIFEST_VERSION = "gordi-product-seed-v1"
EXPECTED_GROUP_COUNTS = {
    "MALE/TOP": 48,
    "MALE/BOTTOM": 50,
    "FEMALE/TOP": 50,
    "FEMALE/BOTTOM": 50,
}
EXPECTED_PRODUCT_COUNT = 198
EXPECTED_SIZE_ROW_COUNT = 732
_TWO_PLACES = Decimal("0.01")


class ManifestError(RuntimeError):
    """Raised when no complete, validated seed manifest can be written."""


def export_seed_manifest(
    dataset_root: Path,
    selection_file: Path,
    output_path: Path,
    *,
    expected_group_counts: dict[str, int] | None = None,
    expected_size_rows: int | None = None,
) -> dict[str, Any]:
    """Validate all selected records in memory, then atomically write one JSON."""
    dataset_root = dataset_root.resolve()
    selection_file = selection_file.resolve()
    output_path = output_path.resolve()
    expected_groups = (
        EXPECTED_GROUP_COUNTS
        if expected_group_counts is None
        else expected_group_counts
    )
    expected_rows = (
        EXPECTED_SIZE_ROW_COUNT
        if expected_size_rows is None
        else expected_size_rows
    )

    grouped_ids = _load_grouped_ids(selection_file)
    selected_ids = [
        external_id
        for group_ids in grouped_ids.values()
        for external_id in group_ids
    ]
    if len(selected_ids) != len(set(selected_ids)):
        raise ManifestError("selection contains duplicate external_id")
    if len(selected_ids) != sum(expected_groups.values()):
        raise ManifestError(
            f"expected {sum(expected_groups.values())} selected products, "
            f"got {len(selected_ids)}"
        )

    actual_groups: Counter[str] = Counter()
    products: list[dict[str, Any]] = []
    seen_keys: set[tuple[str, str]] = set()
    size_row_count = 0

    for declared_group, external_id in _iter_grouped_ids(grouped_ids):
        path = (
            dataset_root
            / "normalized"
            / "musinsa"
            / f"{external_id}.json"
        )
        record = _load_record(path)
        product = record.product
        source = record.source
        actual_group = (
            f"{product.gender.value}/{product.backend_category.value}"
        )
        if actual_group != declared_group:
            raise ManifestError(
                f"{external_id}: declared group {declared_group}, "
                f"actual {actual_group}"
            )
        actual_groups[actual_group] += 1

        if source.name != "MUSINSA":
            raise ManifestError(f"{external_id}: source must be MUSINSA")
        if source.external_product_id != external_id:
            raise ManifestError(
                f"{external_id}: source.external_product_id mismatch"
            )
        key = (source.name, external_id)
        if key in seen_keys:
            raise ManifestError(f"duplicate source/external_id: {key}")
        seen_keys.add(key)
        if record.validation.status != ValidationStatus.READY:
            raise ManifestError(
                f"{external_id}: validation status must be READY"
            )
        if not record.validation.reviewer:
            raise ManifestError(f"{external_id}: reviewer missing")
        if record.validation.validated_at is None:
            raise ManifestError(f"{external_id}: reviewed_at missing")
        if len(source.raw_bundle_sha256) != 64:
            raise ManifestError(
                f"{external_id}: raw_bundle_sha256 invalid"
            )
        if product.style_group_id == "0":
            raise ManifestError(
                f"{external_id}: style_group_id 0 must be null"
            )
        if product.price_krw is None or product.price_krw < 0:
            raise ManifestError(f"{external_id}: valid price_krw required")
        if product.backend_category not in {
            BackendCategory.TOP,
            BackendCategory.BOTTOM,
        }:
            raise ManifestError(
                f"{external_id}: seed supports TOP/BOTTOM only"
            )

        primary = _validate_primary(record, dataset_root)
        sizes = [
            _export_size(
                external_id,
                product.backend_category,
                size.model_dump(mode="python"),
            )
            for size in record.sizes
        ]
        if not sizes:
            raise ManifestError(f"{external_id}: sizes empty")
        size_row_count += len(sizes)

        products.append(
            {
                "source": source.name,
                "external_id": external_id,
                "name": product.name,
                "brand": product.brand,
                "gender": product.gender.value,
                "category": product.backend_category.value,
                "subcategory": product.backend_subcategory.value,
                "price": product.price_krw,
                "currency": product.currency,
                "availability": "AVAILABLE",
                "purchase_url": source.product_url,
                "description": product.description,
                "source_classification": {
                    "category": product.category,
                    "subcategory": product.subcategory,
                    "classification_note": product.classification_note,
                    "is_set_product": product.is_set_product,
                    "temporary_classification_reason": (
                        product.temporary_classification_reason
                    ),
                },
                "style_code": product.style_code,
                "style_group_id": product.style_group_id,
                "raw_bundle_sha256": source.raw_bundle_sha256,
                "primary": primary,
                "sizes": sizes,
                "review": {
                    "reviewer": record.validation.reviewer,
                    "reviewed_at": (
                        record.validation.validated_at.isoformat()
                        if record.validation.validated_at
                        else None
                    ),
                },
            }
        )

    if dict(actual_groups) != expected_groups:
        raise ManifestError(
            f"selection group counts mismatch: {dict(actual_groups)}"
        )
    if size_row_count != expected_rows:
        raise ManifestError(
            f"expected {expected_rows} size rows, got {size_row_count}"
        )

    payload: dict[str, Any] = {
        "schema_version": MANIFEST_VERSION,
        "dataset_schema_version": SCHEMA_VERSION,
        "selection_sha256": DatasetStorage.sha256_json(grouped_ids),
        "product_count": len(products),
        "size_row_count": size_row_count,
        "group_counts": dict(actual_groups),
        "products": products,
    }
    payload["manifest_sha256"] = DatasetStorage.sha256_json(payload)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    DatasetStorage.atomic_write_json(output_path, payload)
    return payload


def _load_grouped_ids(path: Path) -> dict[str, list[str]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ManifestError(f"cannot read selection file: {exc}") from exc
    ids = payload.get("ids") if isinstance(payload, dict) else None
    if not isinstance(ids, dict):
        raise ManifestError("selection file must contain an ids object")
    grouped: dict[str, list[str]] = {}
    for group, values in ids.items():
        if not isinstance(group, str) or not isinstance(values, list):
            raise ManifestError("selection ids entries must be string lists")
        grouped[group] = [str(value) for value in values]
    return grouped


def _iter_grouped_ids(
    grouped_ids: dict[str, list[str]],
) -> list[tuple[str, str]]:
    return [
        (group, external_id)
        for group, external_ids in grouped_ids.items()
        for external_id in external_ids
    ]


def _load_record(path: Path) -> GarmentRecord:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return GarmentRecord.model_validate(payload)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        raise ManifestError(f"cannot load record {path}: {exc}") from exc


def _validate_primary(
    record: GarmentRecord,
    dataset_root: Path,
) -> dict[str, Any]:
    external_id = record.source.external_product_id
    if len(record.images) != 1 or record.images[0].role.value != "PRIMARY":
        raise ManifestError(
            f"{external_id}: exactly one PRIMARY image required"
        )
    primary = record.images[0]
    if (
        primary.view == ImageView.UNKNOWN
        or primary.reference_type == ReferenceType.UNKNOWN
        or primary.model_present is None
        or primary.other_garments_present is None
    ):
        raise ManifestError(
            f"{external_id}: PRIMARY manual review fields incomplete"
        )
    image_path = (dataset_root / primary.local_path).resolve()
    try:
        image_path.relative_to(dataset_root)
    except ValueError as exc:
        raise ManifestError(
            f"{external_id}: PRIMARY path escapes dataset root"
        ) from exc
    if not image_path.is_file():
        raise ManifestError(f"{external_id}: PRIMARY image file missing")
    content = image_path.read_bytes()
    actual_sha = DatasetStorage.sha256_bytes(content)
    inspected = inspect_image(content, actual_sha)
    if (
        actual_sha != primary.sha256
        or inspected.byte_size != primary.byte_size
        or inspected.mime_type != primary.mime_type
        or inspected.width != primary.width
        or inspected.height != primary.height
    ):
        raise ManifestError(
            f"{external_id}: PRIMARY metadata/hash does not match file"
        )
    return {
        "local_path": primary.local_path,
        "sha256": primary.sha256,
        "mime_type": primary.mime_type,
        "byte_size": primary.byte_size,
        "width": primary.width,
        "height": primary.height,
    }


def _export_size(
    external_id: str,
    category: BackendCategory,
    size: dict[str, Any],
) -> dict[str, Any]:
    measurements = size.get("measurements_cm")
    if not isinstance(measurements, dict):
        raise ManifestError(f"{external_id}: measurements_cm missing")
    if not str(size.get("size_name") or "").strip():
        raise ManifestError(f"{external_id}: size_name missing")
    # validate.py의 완화된 필수 세트와 일치해야 한다:
    # shoulder_width/hip_width는 optional (결측 → DB NULL).
    required = (
        ("total_length", "chest_width")
        if category == BackendCategory.TOP
        else ("total_length", "waist_width")
    )
    missing = [field for field in required if measurements.get(field) is None]
    if missing:
        raise ManifestError(
            f"{external_id} size {size.get('size_name')}: "
            f"missing required measurements {missing}"
        )
    converted = {
        field: _decimal_string(value)
        for field, value in measurements.items()
    }
    return {
        "size_name": str(size.get("size_name") or ""),
        "measurements_cm": converted,
    }


def _decimal_string(value: Any) -> str | None:
    if value is None:
        return None
    decimal_value = Decimal(str(value))
    if not decimal_value.is_finite() or decimal_value <= 0:
        raise ManifestError(f"invalid measurement value: {value}")
    return format(
        decimal_value.quantize(_TWO_PLACES, rounding=ROUND_HALF_UP),
        ".2f",
    )
