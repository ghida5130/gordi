"""VLM-assisted primary-image review for normalized dataset records.

Fills the four manual-review fields (``view``, ``reference_type``,
``model_present``, ``other_garments_present``) that block READY, using a
small vision model, then re-runs validation so a record only becomes
READY when nothing else is wrong (size outlier warnings still hold a
record in REVIEW_REQUIRED for human eyes).

Answers outside the closed vocabulary are rejected and the record is
left untouched — the VLM proposes, the schema disposes.
"""

from __future__ import annotations

import json
import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

from garment_collector.models import (
    GarmentRecord,
    ImageView,
    ReferenceType,
    ValidationStatus,
)
from garment_collector.storage import DatasetStorage
from garment_collector.validate import validate_record

logger = logging.getLogger(__name__)

_ALLOWED_VIEWS = {
    view.value for view in ImageView if view != ImageView.UNKNOWN
}
_ALLOWED_REFERENCE_TYPES = {
    ref.value for ref in ReferenceType if ref != ReferenceType.UNKNOWN
}

_SYSTEM_PROMPT = (
    "You are auditing e-commerce garment product photos. Answer with "
    "one JSON object only, no prose:\n"
    '{"view": "FRONT|BACK|SIDE|DETAIL", '
    '"reference_type": "product-only|worn-reference", '
    '"model_present": true|false, '
    '"other_garments_present": true|false}\n'
    "Definitions: view is the camera angle on the main garment "
    "(DETAIL = close-up crop). reference_type is product-only when the "
    "garment is shown flat/on a hanger/ghost mannequin, worn-reference "
    "when a person or full mannequin wears it. model_present is true "
    "only when a human model is visible (face not required). "
    "other_garments_present is true when clothing items other than the "
    "main garment are clearly visible (e.g. styled outfit pieces)."
)

_USER_INSTRUCTION = "Classify this product photo as JSON."


class VLMClient(Protocol):
    def complete_json(
        self,
        *,
        system: str,
        user_parts: list[dict[str, Any]],
        max_tokens: int | None = None,
        reasoning_effort: str | None = None,
    ) -> dict[str, Any]:
        """Return one parsed JSON object from the model."""


@dataclass
class ReviewReport:
    scanned: int = 0
    reviewed: int = 0
    ready: int = 0
    still_review_required: int = 0
    skipped_not_target: int = 0
    rejected_answers: int = 0
    failed: int = 0
    errors: list[dict[str, str]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "scanned": self.scanned,
            "reviewed": self.reviewed,
            "ready": self.ready,
            "still_review_required": self.still_review_required,
            "skipped_not_target": self.skipped_not_target,
            "rejected_answers": self.rejected_answers,
            "failed": self.failed,
            "errors": self.errors,
        }


class ImageReviewError(RuntimeError):
    """Raised when the review run cannot start."""


def parse_review_answer(payload: dict[str, Any]) -> dict[str, Any]:
    """Validate one VLM answer against the closed vocabulary."""
    view = str(payload.get("view", "")).strip().upper()
    reference_type = (
        str(payload.get("reference_type", "")).strip().lower()
    )
    model_present = payload.get("model_present")
    other_garments = payload.get("other_garments_present")
    if view not in _ALLOWED_VIEWS:
        raise ValueError(f"view not in vocabulary: {view!r}")
    if reference_type not in _ALLOWED_REFERENCE_TYPES:
        raise ValueError(
            f"reference_type not in vocabulary: {reference_type!r}"
        )
    if not isinstance(model_present, bool):
        raise ValueError("model_present must be boolean")
    if not isinstance(other_garments, bool):
        raise ValueError("other_garments_present must be boolean")
    return {
        "view": ImageView(view),
        "reference_type": ReferenceType(reference_type),
        "model_present": model_present,
        "other_garments_present": other_garments,
    }


def _needs_image_review(record: GarmentRecord) -> bool:
    if record.validation.status != ValidationStatus.REVIEW_REQUIRED:
        return False
    if not record.images:
        return False
    primary = record.images[0]
    return (
        primary.view == ImageView.UNKNOWN
        or primary.reference_type == ReferenceType.UNKNOWN
        or primary.model_present is None
        or primary.other_garments_present is None
    )


def review_dataset_images(
    dataset_root: Path,
    client: VLMClient,
    *,
    reviewer: str,
    limit: int | None = None,
    concurrency: int = 8,
    dry_run: bool = False,
    reasoning_effort: str | None = "low",
    max_tokens: int = 256,
) -> ReviewReport:
    dataset_root = dataset_root.resolve()
    if not reviewer.strip():
        raise ImageReviewError("reviewer must not be empty")
    if concurrency < 1 or concurrency > 32:
        raise ImageReviewError("concurrency must be between 1 and 32")
    storage = DatasetStorage(dataset_root)
    paths = sorted(
        (dataset_root / "normalized").rglob("*.json")
    )
    if not paths:
        raise ImageReviewError(
            f"no normalized records under {dataset_root}"
        )

    report = ReviewReport()
    targets: list[tuple[Path, GarmentRecord]] = []
    for path in paths:
        report.scanned += 1
        record = GarmentRecord.model_validate(
            json.loads(path.read_text(encoding="utf-8"))
        )
        if not _needs_image_review(record):
            report.skipped_not_target += 1
            continue
        targets.append((path, record))
        if limit is not None and len(targets) >= limit:
            break

    if dry_run:
        report.reviewed = 0
        report.errors = []
        report.failed = 0
        logger.info(
            "dry-run: %d records would be reviewed", len(targets)
        )
        report.skipped_not_target = report.scanned - len(targets)
        return report

    lock = threading.Lock()
    done = 0

    def review_one(item: tuple[Path, GarmentRecord]) -> None:
        nonlocal done
        _, record = item
        external_id = record.source.external_product_id
        try:
            primary = record.images[0]
            image_path = dataset_root / primary.local_path
            content = image_path.read_bytes()
            answer = client.complete_json(
                system=_SYSTEM_PROMPT,
                user_parts=[
                    _image_part(content, primary.mime_type),
                    {"type": "text", "text": _USER_INSTRUCTION},
                ],
                # Hidden reasoning draws from the same cap (rerank
                # benchmark lesson, 2026-08-01), so the cap must scale
                # with effort — higher effort needs more headroom or
                # the JSON answer truncates. effort None for models
                # that reject the reasoning field (e.g. Gemma).
                max_tokens=max_tokens,
                reasoning_effort=reasoning_effort,
            )
            fields = parse_review_answer(answer)
        except ValueError as exc:
            with lock:
                report.rejected_answers += 1
                report.errors.append(
                    {"external_id": external_id, "error": str(exc)}
                )
            return
        except Exception as exc:  # noqa: BLE001 — per-record isolation
            logger.warning(
                "image review failed external_id=%s", external_id,
                exc_info=True,
            )
            with lock:
                report.failed += 1
                report.errors.append(
                    {"external_id": external_id, "error": str(exc)}
                )
            return

        primary.view = fields["view"]
        primary.reference_type = fields["reference_type"]
        primary.model_present = fields["model_present"]
        primary.other_garments_present = (
            fields["other_garments_present"]
        )
        record.validation.reviewer = reviewer
        record.validation.status = ValidationStatus.READY
        reviewed = validate_record(record, dataset_root=dataset_root)
        storage.write_normalized(reviewed)
        with lock:
            report.reviewed += 1
            if reviewed.validation.status == ValidationStatus.READY:
                report.ready += 1
            else:
                report.still_review_required += 1
            done += 1
            if done % 100 == 0:
                logger.info(
                    "image review progress %d/%d", done, len(targets)
                )

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        list(executor.map(review_one, targets))

    storage.write_report("image-review-summary.json", report.to_dict())
    return report


def _image_part(content: bytes, mime_type: str) -> dict[str, Any]:
    import base64

    encoded = base64.b64encode(content).decode("ascii")
    return {
        "type": "image_url",
        "image_url": {"url": f"data:{mime_type};base64,{encoded}"},
    }


__all__ = [
    "ImageReviewError",
    "ReviewReport",
    "parse_review_answer",
    "review_dataset_images",
]
