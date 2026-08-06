"""VLM TPO tagging for READY dataset records.

Produces an AI-internal sidecar JSONL (never the backend DB): per
product, closed-vocabulary occasion tags, an ordinal formality level,
and an open-vocabulary one-line Korean caption. The embedding text is
rendered here at tagging time — Korean natural language, not enum
strings — so the embedding builder only appends a ready-made sentence.

Answers outside the vocabulary are rejected and the product is left
untagged (the VLM proposes, the schema disposes). Re-running skips
products already present in the output file, so the run is idempotent
and resumable per file.
"""

from __future__ import annotations

import json
import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from garment_collector.image_review import VLMClient, _image_part
from garment_collector.models import GarmentRecord, ValidationStatus

logger = logging.getLogger(__name__)

TPO_TAG_SCHEMA_VERSION = "garment-tpo-tags-v1"
MAX_OCCASIONS = 3
MAX_CAPTION_LENGTH = 200

OCCASION_LABELS = {
    "BUSINESS_FORMAL": "면접·격식 자리",
    "OFFICE_CASUAL": "출근·오피스",
    "CEREMONY": "결혼식 하객·가족 행사",
    "DATE_SOCIAL": "데이트·모임",
    "DAILY": "일상·데일리",
    "OUTDOOR_LEISURE": "야외 나들이·여행",
    "SPORTS": "운동·스포츠",
}
FORMALITY_LABELS = {
    4: "포멀한 격식 차림",
    3: "단정한 세미포멀",
    2: "깔끔한 캐주얼",
    1: "편안한 이지웨어",
}

_SYSTEM_PROMPT = (
    "You are tagging Korean e-commerce garments for TPO (time/place/"
    "occasion) suitability. Judge wearability: would wearing this "
    "garment to the occasion look appropriate (not whether it is "
    "occasion-exclusive)? Answer with one JSON object only, no "
    "prose:\n"
    '{"occasions": ["TAG", ...], "formality": 1|2|3|4, '
    '"caption": "한국어 한 문장"}\n'
    "occasions: 1 to 3 tags from exactly this set —\n"
    "BUSINESS_FORMAL (job interviews, formal offices, official "
    "events), OFFICE_CASUAL (business-casual offices, conferences), "
    "CEREMONY (wedding guest, family gatherings, formal family "
    "events), DATE_SOCIAL (dates, parties, social outings, "
    "exhibitions), DAILY (campus, commuting, everyday errands), "
    "OUTDOOR_LEISURE (picnics, trips, camping, outdoor festivals), "
    "SPORTS (gym, running, athletic activity).\n"
    "formality: 4 = formal/suit-grade, 3 = dressy semi-formal, "
    "2 = neat casual, 1 = relaxed/athleisure.\n"
    "caption: one Korean sentence (under 120 chars) describing when "
    "and where this garment works, e.g. "
    '"하객룩이나 오피스룩으로 입기 좋은 단정하고 화사한 셔츠". '
    "Describe only what is visible; no brand praise, no price talk."
)


class TpoTaggingError(RuntimeError):
    """Raised when the tagging run cannot start."""


@dataclass
class TagReport:
    scanned: int = 0
    tagged: int = 0
    skipped_already_tagged: int = 0
    skipped_not_ready: int = 0
    rejected_answers: int = 0
    failed: int = 0
    errors: list[dict[str, str]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "scanned": self.scanned,
            "tagged": self.tagged,
            "skipped_already_tagged": self.skipped_already_tagged,
            "skipped_not_ready": self.skipped_not_ready,
            "rejected_answers": self.rejected_answers,
            "failed": self.failed,
            "errors": self.errors,
        }


def render_embedding_text(
    occasions: list[str],
    formality: int,
    caption: str,
) -> str:
    """Korean sentence for the embedding document.

    Enum strings carry almost no meaning in Korean embedding space,
    so tags are rendered as natural-language phrases.
    """
    labels = ", ".join(
        OCCASION_LABELS[occasion] for occasion in occasions
    )
    return (
        f"TPO: {labels}에 어울리는 "
        f"{FORMALITY_LABELS[formality]}. {caption}"
    )


def parse_tag_answer(payload: dict[str, Any]) -> dict[str, Any]:
    """Validate one VLM answer against the closed vocabulary."""
    raw_occasions = payload.get("occasions")
    if not isinstance(raw_occasions, list) or not raw_occasions:
        raise ValueError("occasions must be a non-empty list")
    occasions: list[str] = []
    for raw in raw_occasions:
        occasion = str(raw).strip().upper()
        if occasion not in OCCASION_LABELS:
            raise ValueError(
                f"occasion not in vocabulary: {occasion!r}"
            )
        if occasion not in occasions:
            occasions.append(occasion)
    if len(occasions) > MAX_OCCASIONS:
        raise ValueError(
            f"at most {MAX_OCCASIONS} occasions allowed"
        )
    formality = payload.get("formality")
    if isinstance(formality, bool) or not isinstance(formality, int):
        raise ValueError("formality must be an integer")
    if formality not in FORMALITY_LABELS:
        raise ValueError(f"formality out of range: {formality}")
    caption = str(payload.get("caption") or "").strip()
    if not caption:
        raise ValueError("caption must not be empty")
    if len(caption) > MAX_CAPTION_LENGTH:
        raise ValueError("caption too long")
    return {
        "occasions": occasions,
        "formality": formality,
        "caption": caption,
    }


def load_tagged_ids(output_path: Path) -> set[str]:
    if not output_path.exists():
        return set()
    tagged: set[str] = set()
    for line in output_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        tagged.add(str(json.loads(line).get("external_id")))
    return tagged


def tag_dataset_tpo(
    dataset_root: Path,
    client: VLMClient | None,
    *,
    output_path: Path,
    reasoning_effort: str | None = "medium",
    max_tokens: int = 2048,
    concurrency: int = 8,
    limit: int | None = None,
    dry_run: bool = False,
) -> TagReport:
    dataset_root = dataset_root.resolve()
    if concurrency < 1 or concurrency > 32:
        raise TpoTaggingError("concurrency must be between 1 and 32")
    paths = sorted((dataset_root / "normalized").rglob("*.json"))
    if not paths:
        raise TpoTaggingError(
            f"no normalized records under {dataset_root}"
        )
    already_tagged = load_tagged_ids(output_path)

    report = TagReport()
    targets: list[GarmentRecord] = []
    for path in paths:
        report.scanned += 1
        record = GarmentRecord.model_validate(
            json.loads(path.read_text(encoding="utf-8"))
        )
        if record.validation.status != ValidationStatus.READY:
            report.skipped_not_ready += 1
            continue
        if record.source.external_product_id in already_tagged:
            report.skipped_already_tagged += 1
            continue
        targets.append(record)
        if limit is not None and len(targets) >= limit:
            break

    if dry_run:
        logger.info(
            "dry-run: %d records would be tagged", len(targets)
        )
        return report
    if client is None:
        raise TpoTaggingError("VLM client is required unless dry-run")

    lock = threading.Lock()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    tagged_at = datetime.now(timezone.utc).isoformat()

    def tag_one(record: GarmentRecord) -> None:
        external_id = record.source.external_product_id
        try:
            primary = record.images[0]
            content = (dataset_root / primary.local_path).read_bytes()
            user_parts = [
                _image_part(content, primary.mime_type),
                {
                    "type": "text",
                    "text": (
                        f"상품명: {record.product.name}\n"
                        f"분류: {record.product.backend_category.value}"
                        f"/{record.product.backend_subcategory.value}\n"
                        f"성별: {record.product.gender.value}"
                    ),
                },
            ]
            answer = None
            for attempt in (1, 2):
                try:
                    answer = client.complete_json(
                        system=_SYSTEM_PROMPT,
                        user_parts=user_parts,
                        max_tokens=max_tokens,
                        reasoning_effort=reasoning_effort,
                    )
                    break
                except Exception:
                    # 빈 응답 등 provider 일시 오류는 한 번만 즉시
                    # 재시도한다 (2026-08-05 밤 luna 큐 장애에서 1.3만
                    # 건이 이 오류로 연쇄 실패). 두 번째도 실패하면
                    # 바깥 except 가 기록한다.
                    if attempt == 2:
                        raise
            fields = parse_tag_answer(answer)
        except ValueError as exc:
            with lock:
                report.rejected_answers += 1
                report.errors.append(
                    {"external_id": external_id, "error": str(exc)}
                )
            return
        except Exception as exc:  # noqa: BLE001 — per-record isolation
            logger.warning(
                "tpo tagging failed external_id=%s",
                external_id,
                exc_info=True,
            )
            with lock:
                report.failed += 1
                report.errors.append(
                    {"external_id": external_id, "error": str(exc)}
                )
            return
        row = {
            "schema_version": TPO_TAG_SCHEMA_VERSION,
            "source": record.source.name,
            "external_id": external_id,
            "occasions": fields["occasions"],
            "formality": fields["formality"],
            "caption": fields["caption"],
            "embedding_text": render_embedding_text(
                fields["occasions"],
                fields["formality"],
                fields["caption"],
            ),
            "tagger": f"vlm:{getattr(client, 'model', 'unknown')}",
            "reasoning_effort": reasoning_effort,
            "tagged_at": tagged_at,
        }
        with lock:
            with output_path.open("a", encoding="utf-8") as handle:
                handle.write(
                    json.dumps(row, ensure_ascii=False) + "\n"
                )
            report.tagged += 1
            if report.tagged % 200 == 0:
                logger.info(
                    "tpo tagging progress: %d/%d",
                    report.tagged,
                    len(targets),
                )

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        list(executor.map(tag_one, targets))
    return report


__all__ = [
    "FORMALITY_LABELS",
    "MAX_OCCASIONS",
    "OCCASION_LABELS",
    "TPO_TAG_SCHEMA_VERSION",
    "TagReport",
    "TpoTaggingError",
    "load_tagged_ids",
    "parse_tag_answer",
    "render_embedding_text",
    "tag_dataset_tpo",
]
