"""Offline conversion of a collected v1 bundle into primary-only dataset v2."""

from __future__ import annotations

import json
import shutil
from collections import Counter
from pathlib import Path
from typing import Any

from garment_collector import (
    COLLECTOR_NAME,
    POLICY_EXCEPTION,
    SCHEMA_VERSION,
    __version__,
)
from garment_collector.adapters.musinsa.parser import (
    build_product_url,
    parse_goods_detail_payload,
)
from garment_collector.images import inspect_image
from garment_collector.models import (
    GarmentRecord,
    ImageMeta,
    ImageRole,
    ImageView,
    ProductMeta,
    ReferenceType,
    SourceMeta,
    ValidationInfo,
    ValidationStatus,
)
from garment_collector.storage import DatasetStorage
from garment_collector.validate import validate_record


class ReprocessError(RuntimeError):
    """Raised when the source bundle cannot produce a complete v2 dataset."""


def reprocess_dataset(source_root: Path, output_root: Path) -> dict[str, Any]:
    """Reparse every source.json without network access.

    The v1 source dataset remains untouched. The output contains only normalized
    JSON, one primary image per product, and a non-sensitive count/hash report.
    """
    source_root = source_root.resolve()
    output_root = output_root.resolve()
    if source_root == output_root:
        raise ReprocessError("source and output roots must be different")
    if not source_root.is_dir():
        raise ReprocessError(f"source root does not exist: {source_root}")
    if output_root.exists() and any(output_root.iterdir()):
        raise ReprocessError(f"output root must be empty: {output_root}")

    raw_paths = sorted((source_root / "raw" / "musinsa").glob("*/source.json"))
    if not raw_paths:
        raise ReprocessError("no raw/musinsa/*/source.json files found")

    storage = DatasetStorage(output_root)
    storage.ensure_layout()
    statuses: Counter[str] = Counter()
    primary_hashes: Counter[str] = Counter()
    expected_images: set[Path] = set()
    errors: list[dict[str, str]] = []

    for source_path in raw_paths:
        product_id = source_path.parent.name
        try:
            old_path = (
                source_root / "normalized" / "musinsa" / f"{product_id}.json"
            )
            old = _read_json(old_path)
            raw_bundle = _read_json(source_path)
            record, source_image = _build_record(
                product_id=product_id,
                old=old,
                raw_bundle=raw_bundle,
                source_root=source_root,
                output_root=output_root,
            )

            primary = record.images[0]
            destination = output_root / primary.local_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source_image, destination)
            expected_images.add(destination.resolve())

            record = validate_record(record, dataset_root=output_root)
            storage.write_normalized(record)
            statuses[record.validation.status.value] += 1
            primary_hashes[primary.sha256] += 1
        except Exception as exc:  # noqa: BLE001 - complete audit report
            errors.append({"external_id": product_id, "error": str(exc)})

    actual_images = {
        path.resolve()
        for path in (output_root / "images").rglob("*")
        if path.is_file()
    }
    duplicates = sorted(
        digest for digest, count in primary_hashes.items() if count > 1
    )
    alternates = [
        path for path in actual_images if path.name.lower().startswith("alternate")
    ]
    orphan_images = sorted(str(path) for path in actual_images - expected_images)

    summary: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "source_root": str(source_root),
        "raw_bundle_count": len(raw_paths),
        "normalized_count": sum(statuses.values()),
        "primary_image_count": len(expected_images),
        "alternate_image_count": len(alternates),
        "orphan_image_count": len(orphan_images),
        "duplicate_primary_hash_count": len(duplicates),
        "status_counts": dict(sorted(statuses.items())),
        "errors": errors,
        "duplicate_primary_hashes": duplicates,
        "orphan_images": orphan_images,
    }
    storage.write_report("reprocess-summary.json", summary)

    if (
        errors
        or summary["normalized_count"] != len(raw_paths)
        or summary["primary_image_count"] != len(raw_paths)
        or alternates
        or orphan_images
        or duplicates
    ):
        raise ReprocessError(
            "v2 invariant failed; inspect reports/reprocess-summary.json"
        )
    return summary


def _build_record(
    *,
    product_id: str,
    old: dict[str, Any],
    raw_bundle: dict[str, Any],
    source_root: Path,
    output_root: Path,
) -> tuple[GarmentRecord, Path]:
    detail = raw_bundle.get("detail")
    if not isinstance(detail, dict):
        raise ReprocessError("raw bundle detail missing")
    product_url = old.get("source", {}).get("product_url") or build_product_url(
        product_id
    )
    parsed = parse_goods_detail_payload(
        product_id,
        product_url,
        detail,
        options_payload=_optional_dict(raw_bundle.get("options")),
        actual_size_payload=_optional_dict(raw_bundle.get("actual_size")),
    )
    if parsed.excluded:
        raise ReprocessError(f"parser excluded product: {parsed.exclude_reason}")

    old_images = old.get("images")
    if not isinstance(old_images, list):
        raise ReprocessError("old normalized images missing")
    old_primary = next(
        (
            image
            for image in old_images
            if isinstance(image, dict) and image.get("role") == "PRIMARY"
        ),
        None,
    )
    if old_primary is None:
        raise ReprocessError("old PRIMARY image missing")
    old_local_path = old_primary.get("local_path")
    if not isinstance(old_local_path, str):
        raise ReprocessError("old PRIMARY local_path missing")
    source_image = (source_root / old_local_path).resolve()
    if not source_image.is_file():
        raise ReprocessError(f"old PRIMARY file missing: {old_local_path}")

    content = source_image.read_bytes()
    digest = DatasetStorage.sha256_bytes(content)
    inspected = inspect_image(content, digest)
    filename = f"primary{inspected.extension}"
    local_path = DatasetStorage(output_root).image_relative_path(
        "MUSINSA", product_id, filename
    )

    old_source = old.get("source")
    if not isinstance(old_source, dict):
        raise ReprocessError("old normalized source missing")
    old_product = old.get("product")
    if not isinstance(old_product, dict):
        old_product = {}

    record = GarmentRecord(
        schema_version=SCHEMA_VERSION,
        source=SourceMeta(
            name="MUSINSA",
            external_product_id=product_id,
            product_url=product_url,
            collection_method=old_source.get(
                "collection_method", "public-html-slow-fetch"
            ),
            collector_name=COLLECTOR_NAME,
            collector_version=__version__,
            collected_at=old_source["collected_at"],
            last_seen_at=old_source["last_seen_at"],
            rights_status=old_source.get(
                "rights_status", "internal-evaluation-only-unverified"
            ),
            policy_exception=old_source.get(
                "policy_exception", POLICY_EXCEPTION
            ),
            robots_txt_note=old_source.get("robots_txt_note"),
            raw_bundle_sha256=DatasetStorage.sha256_json(raw_bundle),
        ),
        product=ProductMeta(
            name=parsed.name,
            brand=parsed.brand,
            style_code=parsed.style_code,
            style_group_id=parsed.style_group_id,
            price_krw=parsed.price_krw,
            original_price_krw=parsed.original_price_krw,
            gender=parsed.gender,
            slot=parsed.slot,
            category=parsed.category,
            subcategory=parsed.subcategory,
            backend_category=parsed.backend_category,
            backend_subcategory=parsed.backend_subcategory,
            color_name=parsed.color_name,
            color_group=parsed.color_group,
            season=old_product.get("season"),
            material=parsed.material,
            description=parsed.description,
            sale_status=parsed.sale_status,
            classification_note=parsed.classification_note,
            is_set_product=parsed.is_set_product,
            temporary_classification_reason=(
                parsed.temporary_classification_reason
            ),
        ),
        images=[
            ImageMeta(
                local_path=local_path,
                source_url=(
                    parsed.image_urls[0]
                    if parsed.image_urls
                    else str(old_primary.get("source_url") or "")
                ),
                role=ImageRole.PRIMARY,
                view=ImageView.UNKNOWN,
                reference_type=ReferenceType.UNKNOWN,
                model_present=None,
                other_garments_present=None,
                width=inspected.width,
                height=inspected.height,
                mime_type=inspected.mime_type,
                byte_size=inspected.byte_size,
                sha256=inspected.sha256,
            )
        ],
        sizes=parsed.sizes,
        validation=ValidationInfo(status=ValidationStatus.RAW),
    )
    return record, source_image


def _read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ReprocessError(f"cannot read JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ReprocessError(f"JSON root must be object: {path}")
    return value


def _optional_dict(value: Any) -> dict[str, Any] | None:
    return value if isinstance(value, dict) else None
