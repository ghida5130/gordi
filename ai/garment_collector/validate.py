"""Automatic validation for garment records (policy §7, §11, §12)."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from garment_collector import SCHEMA_VERSION
from garment_collector.config import MIN_IMAGE_EDGE_PX
from garment_collector.images import inspect_image
from garment_collector.models import (
    BackendCategory,
    BackendSubcategory,
    GarmentRecord,
    ImageRole,
    ImageView,
    MeasurementsCm,
    ReferenceType,
    Slot,
    ValidationStatus,
)
from garment_collector.storage import DatasetStorage


_BACKEND_SUBCATEGORIES = {
    BackendCategory.TOP: {
        BackendSubcategory.SHORT_SLEEVE,
        BackendSubcategory.LONG_SLEEVE,
        BackendSubcategory.SHIRT,
        BackendSubcategory.KNIT,
        BackendSubcategory.HOODIE,
        BackendSubcategory.SLEEVELESS,
        BackendSubcategory.SPORTS_TOP,
        BackendSubcategory.OTHER_TOP,
        BackendSubcategory.DRESS,
    },
    BackendCategory.BOTTOM: {
        BackendSubcategory.DENIM_PANTS,
        BackendSubcategory.SLACKS,
        BackendSubcategory.SHORTS,
        BackendSubcategory.SKIRT,
        BackendSubcategory.COTTON_PANTS,
        BackendSubcategory.JOGGER_PANTS,
        BackendSubcategory.SPORTS_BOTTOM,
        BackendSubcategory.OTHER_BOTTOM,
    },
    BackendCategory.OUTER: {
        BackendSubcategory.JACKET,
        BackendSubcategory.COAT,
        BackendSubcategory.CARDIGAN,
        BackendSubcategory.PADDING,
    },
    BackendCategory.SHOES: {
        BackendSubcategory.SNEAKERS,
        BackendSubcategory.BOOTS,
        BackendSubcategory.LOAFER,
        BackendSubcategory.SANDALS,
    },
}


def _now() -> datetime:
    return datetime.now(timezone.utc).astimezone()


def normalize_zero_measurements(record: GarmentRecord) -> GarmentRecord:
    """Treat source measurement 0 / negative as missing (null)."""
    for size in record.sizes:
        cleaned: dict[str, float | None] = {}
        for field, value in size.measurements_cm.model_dump().items():
            if value is not None and value <= 0:
                cleaned[field] = None
            else:
                cleaned[field] = value
        size.measurements_cm = MeasurementsCm(**cleaned)
    return record


def validate_record(
    record: GarmentRecord,
    *,
    dataset_root: Path | None = None,
) -> GarmentRecord:
    record = normalize_zero_measurements(record)

    # Always recompute — do not accumulate prior auto-warnings.
    warnings: list[str] = []
    hard_errors: list[str] = []

    source = record.source
    product = record.product

    if record.schema_version != SCHEMA_VERSION:
        hard_errors.append(
            f"schema_version must be {SCHEMA_VERSION}"
        )
    if not source.name:
        hard_errors.append("source.name missing")
    if not source.external_product_id:
        hard_errors.append("source.external_product_id missing")
    if not source.product_url.startswith("http"):
        hard_errors.append("source.product_url invalid")
    if len(source.raw_bundle_sha256) != 64:
        hard_errors.append("source.raw_bundle_sha256 invalid")
    if source.collection_method == "public-html-slow-fetch":
        if source.rights_status != "internal-evaluation-only-unverified":
            hard_errors.append(
                "public-html-slow-fetch requires "
                "rights_status=internal-evaluation-only-unverified"
            )
        if not source.policy_exception:
            hard_errors.append(
                "public-html-slow-fetch requires policy_exception"
            )

    if not product.name:
        hard_errors.append("product.name missing")
    if not product.brand:
        hard_errors.append("product.brand missing")
    if not product.category:
        hard_errors.append("product.category missing")
    if not product.subcategory:
        hard_errors.append("product.subcategory missing")
    if product.backend_subcategory not in _BACKEND_SUBCATEGORIES[
        product.backend_category
    ]:
        hard_errors.append(
            "backend category/subcategory combination invalid"
        )
    if product.style_group_id == "0":
        hard_errors.append("product.style_group_id must normalize 0 to null")

    if not record.images:
        hard_errors.append("images empty")
    else:
        primary_images = [
            img for img in record.images if img.role == ImageRole.PRIMARY
        ]
        if len(record.images) != 1 or len(primary_images) != 1:
            hard_errors.append(
                "dataset v2 requires exactly one PRIMARY image"
            )
        else:
            primary = primary_images[0]
            if primary.width < MIN_IMAGE_EDGE_PX or primary.height < MIN_IMAGE_EDGE_PX:
                hard_errors.append(
                    f"PRIMARY image below min resolution "
                    f"{MIN_IMAGE_EDGE_PX}px"
                )
            if not primary.sha256:
                hard_errors.append("PRIMARY image sha256 missing")
            if dataset_root is not None:
                image_path = dataset_root / primary.local_path
                if not image_path.is_file():
                    hard_errors.append(
                        f"PRIMARY image file missing: {primary.local_path}"
                    )
                else:
                    content = image_path.read_bytes()
                    actual_sha = DatasetStorage.sha256_bytes(content)
                    try:
                        inspected = inspect_image(content, actual_sha)
                    except ValueError as exc:
                        hard_errors.append(f"PRIMARY image invalid: {exc}")
                    else:
                        if actual_sha != primary.sha256:
                            hard_errors.append(
                                "PRIMARY image sha256 does not match file"
                            )
                        if inspected.byte_size != primary.byte_size:
                            hard_errors.append(
                                "PRIMARY image byte_size does not match file"
                            )
                        if (
                            inspected.width != primary.width
                            or inspected.height != primary.height
                        ):
                            hard_errors.append(
                                "PRIMARY image dimensions do not match file"
                            )
                        if inspected.mime_type != primary.mime_type:
                            hard_errors.append(
                                "PRIMARY image mime_type does not match file"
                            )
            if primary.view == ImageView.UNKNOWN:
                warnings.append("PRIMARY image view requires manual review")
            if primary.reference_type == ReferenceType.UNKNOWN:
                warnings.append(
                    "PRIMARY image reference_type requires manual review"
                )
            if primary.model_present is None:
                warnings.append(
                    "PRIMARY image model_present requires manual review"
                )
            if primary.other_garments_present is None:
                warnings.append(
                    "PRIMARY image other_garments_present requires manual review"
                )

    if not record.sizes:
        hard_errors.append("sizes empty")
    else:
        _check_required_measurements(record, hard_errors, warnings)
        _check_outliers(record, warnings)

    if hard_errors:
        status = ValidationStatus.INVALID
        warnings = hard_errors + warnings
    elif warnings:
        status = ValidationStatus.REVIEW_REQUIRED
    elif (
        record.validation.status == ValidationStatus.READY
        and record.validation.reviewer
    ):
        status = ValidationStatus.READY
    else:
        status = ValidationStatus.VALIDATED

    record.validation.status = status
    record.validation.validated_at = _now()
    record.validation.warnings = warnings
    return record


def _check_required_measurements(
    record: GarmentRecord,
    hard_errors: list[str],
    warnings: list[str],
) -> None:
    slot = record.product.slot
    any_complete = False

    for size in record.sizes:
        m = size.measurements_cm
        # DRESS is legacy; team maps one-piece → TOP for backend storage.
        if slot in (Slot.TOP, Slot.OUTER, Slot.DRESS):
            required = (m.total_length, m.shoulder_width, m.chest_width)
            labels = ("total_length", "shoulder_width", "chest_width")
        elif slot == Slot.BOTTOM:
            required = (m.total_length, m.waist_width, m.hip_width)
            labels = ("total_length", "waist_width", "hip_width")
        else:
            required = (m.total_length,)
            labels = ("total_length",)

        missing = [label for label, value in zip(labels, required) if value is None]
        if not missing:
            any_complete = True
        else:
            warnings.append(
                f"size {size.size_name}: missing required fields {missing}"
            )

    if not any_complete:
        hard_errors.append(
            f"no size row has all required measurements for slot {slot.value}"
        )


def _check_outliers(record: GarmentRecord, warnings: list[str]) -> None:
    for size in record.sizes:
        for field_name, value in size.measurements_cm.model_dump().items():
            if value is None:
                continue
            if value <= 0:
                warnings.append(
                    f"outlier size={size.size_name} {field_name}={value} (<=0)"
                )
            if value > 250:
                warnings.append(
                    f"outlier size={size.size_name} {field_name}={value} (>250)"
                )
