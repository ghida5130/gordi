"""Collect → store RAW → download images → validate → normalized JSON."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterable

from garment_collector.adapters.base import SourceAdapter
from garment_collector.config import CollectorSettings
from garment_collector.http_client import CollectionStopped, SlowHttpClient
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

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc).astimezone()


@dataclass
class ProductOutcome:
    product_id: str
    status: str
    path: str | None = None
    error: str | None = None


@dataclass
class RunReport:
    started_at: datetime
    finished_at: datetime | None = None
    source: str = ""
    collection_method: str = ""
    rights_status: str = ""
    policy_exception: str = ""
    robots_txt_note: str = ""
    requested: int = 0
    succeeded: int = 0
    failed: int = 0
    skipped: int = 0
    stopped: bool = False
    stop_reason: str | None = None
    outcomes: list[ProductOutcome] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "started_at": self.started_at.isoformat(),
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "source": self.source,
            "collection_method": self.collection_method,
            "rights_status": self.rights_status,
            "policy_exception": self.policy_exception,
            "robots_txt_note": self.robots_txt_note,
            "requested": self.requested,
            "succeeded": self.succeeded,
            "failed": self.failed,
            "skipped": self.skipped,
            "stopped": self.stopped,
            "stop_reason": self.stop_reason,
            "outcomes": [
                {
                    "product_id": o.product_id,
                    "status": o.status,
                    "path": o.path,
                    "error": o.error,
                }
                for o in self.outcomes
            ],
        }


class CollectionPipeline:
    def __init__(
        self,
        settings: CollectorSettings,
        adapter: SourceAdapter,
        storage: DatasetStorage | None = None,
    ) -> None:
        self.settings = settings
        self.adapter = adapter
        self.storage = storage or DatasetStorage(settings.dataset_root)

    def run(self, product_ids: Iterable[str]) -> RunReport:
        ids = [str(pid).strip() for pid in product_ids if str(pid).strip()]
        if (
            self.settings.max_items is not None
            and len(ids) > self.settings.max_items
        ):
            raise ValueError(
                f"requested {len(ids)} products exceeds max_items="
                f"{self.settings.max_items}"
            )

        self.storage.ensure_layout()
        report = RunReport(
            started_at=_now(),
            source=self.adapter.name,
            collection_method=self.settings.collection_method,
            rights_status=self.settings.rights_status,
            policy_exception=self.settings.policy_exception,
            robots_txt_note=self.settings.robots_txt_note,
            requested=len(ids),
        )

        product_client = SlowHttpClient(
            self.settings,
            self.settings.product_delay_sec,
            stop_on_block=True,  # musinsa source block → stop run
        )
        image_client = SlowHttpClient(
            self.settings,
            self.settings.image_delay_sec,
            # Brand/CDN 403 must not abort the whole pilot batch.
            stop_on_block=False,
        )

        try:
            for product_id in ids:
                if product_client.stopped or image_client.stopped:
                    report.stopped = True
                    report.stop_reason = (
                        product_client.stop_reason or image_client.stop_reason
                    )
                    break
                try:
                    outcome = self._collect_one(
                        product_id, product_client, image_client
                    )
                except CollectionStopped as exc:
                    report.stopped = True
                    report.stop_reason = str(exc)
                    report.outcomes.append(
                        ProductOutcome(
                            product_id=product_id,
                            status="stopped",
                            error=str(exc),
                        )
                    )
                    report.failed += 1
                    break
                except Exception as exc:  # noqa: BLE001 — per-product isolation
                    logger.exception("collect failed product_id=%s", product_id)
                    report.outcomes.append(
                        ProductOutcome(
                            product_id=product_id,
                            status="failed",
                            error=str(exc),
                        )
                    )
                    report.failed += 1
                    continue

                report.outcomes.append(outcome)
                if outcome.status == "ok":
                    report.succeeded += 1
                elif outcome.status == "skipped":
                    report.skipped += 1
                else:
                    report.failed += 1
        finally:
            product_client.close()
            image_client.close()
            report.finished_at = _now()
            self.storage.write_report("collection-run.json", report.to_dict())

        return report

    def _collect_one(
        self,
        product_id: str,
        product_client: SlowHttpClient,
        image_client: SlowHttpClient,
    ) -> ProductOutcome:
        if self.settings.skip_existing:
            existing = self.storage.normalized_path(
                self.adapter.name, product_id
            )
            if existing.exists():
                logger.info("skip existing product %s", product_id)
                return ProductOutcome(
                    product_id=product_id,
                    status="skipped",
                    error="already collected",
                )

        url = self.adapter.product_url(product_id)
        logger.info("fetch product %s %s", product_id, url)

        if self.settings.dry_run:
            return ProductOutcome(
                product_id=product_id, status="skipped", error="dry_run"
            )

        fetch_product = getattr(self.adapter, "fetch_product", None)
        if callable(fetch_product):
            parsed, raw_bundle, _primary_body = fetch_product(
                product_id, product_client
            )
            raw_sha = DatasetStorage.sha256_json(raw_bundle)
            self.storage.write_raw_metadata(
                self.adapter.name,
                product_id,
                {
                    "product_id": product_id,
                    "product_url": url,
                    "raw_bundle_sha256": raw_sha,
                    "parsed": parsed.model_dump(mode="json"),
                },
            )
            # Keep a compact JSON snapshot next to metadata for re-parse.
            self.storage.write_raw_metadata(
                self.adapter.name,
                product_id,
                raw_bundle,
                filename="source.json",
            )
        else:
            fetched = product_client.get(url)
            self.storage.write_source_html(
                self.adapter.name, product_id, fetched.content
            )
            parsed = self.adapter.parse_product_html(
                product_id, fetched.final_url or url, fetched.content
            )
            raw_sha = DatasetStorage.sha256_bytes(fetched.content)
            self.storage.write_raw_metadata(
                self.adapter.name,
                product_id,
                {
                    "product_id": product_id,
                    "final_url": fetched.final_url,
                    "status_code": fetched.status_code,
                    "raw_bundle_sha256": raw_sha,
                    "parsed": parsed.model_dump(mode="json"),
                },
            )

        if parsed.excluded:
            logger.info(
                "exclude product=%s reason=%s",
                product_id,
                parsed.exclude_reason,
            )
            return ProductOutcome(
                product_id=product_id,
                status="excluded",
                error=parsed.exclude_reason or "mvp excluded",
            )

        images = self._download_images(
            product_id, parsed.image_urls, image_client
        )
        if not images:
            raise RuntimeError("no valid images downloaded")

        now = _now()
        record = GarmentRecord(
            schema_version=self.settings.schema_version,
            source=SourceMeta(
                name=self.adapter.name,
                external_product_id=product_id,
                product_url=parsed.product_url,
                collection_method=self.settings.collection_method,
                collector_name=self.settings.collector_name,
                collector_version=self.settings.collector_version,
                collected_at=now,
                last_seen_at=now,
                rights_status=self.settings.rights_status,
                policy_exception=self.settings.policy_exception,
                robots_txt_note=self.settings.robots_txt_note,
                raw_bundle_sha256=raw_sha,
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
                material=parsed.material,
                description=parsed.description,
                sale_status=parsed.sale_status,
                classification_note=parsed.classification_note,
                is_set_product=parsed.is_set_product,
                temporary_classification_reason=(
                    parsed.temporary_classification_reason
                ),
            ),
            images=images,
            sizes=parsed.sizes,
            validation=ValidationInfo(status=ValidationStatus.RAW),
        )

        record = validate_record(record, dataset_root=self.storage.root)
        path = self.storage.write_normalized(record)
        return ProductOutcome(
            product_id=product_id,
            status="ok",
            path=str(path),
        )

    def _download_images(
        self,
        product_id: str,
        image_urls: list[str],
        image_client: SlowHttpClient,
    ) -> list[ImageMeta]:
        downloaded: list[tuple[str, object]] = []
        for image_url in image_urls:
            try:
                fetched = image_client.get(image_url)
                sha = DatasetStorage.sha256_bytes(fetched.content)
                inspected = inspect_image(fetched.content, sha)
            except CollectionStopped:
                raise
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "image skip product=%s url=%s err=%s",
                    product_id,
                    image_url,
                    exc,
                )
                continue
            downloaded.append((image_url, inspected))
            break

        if not downloaded:
            return []

        metas: list[ImageMeta] = []
        for image_url, inspected in downloaded:
            role = ImageRole.PRIMARY
            filename = f"primary{inspected.extension}"
            view = ImageView.UNKNOWN

            self.storage.write_image(
                self.adapter.name, product_id, filename, inspected.content
            )
            local_path = self.storage.image_relative_path(
                self.adapter.name, product_id, filename
            )
            metas.append(
                ImageMeta(
                    local_path=local_path,
                    source_url=image_url,
                    role=role,
                    view=view,
                    reference_type=ReferenceType.UNKNOWN,
                    model_present=None,
                    other_garments_present=None,
                    width=inspected.width,
                    height=inspected.height,
                    mime_type=inspected.mime_type,
                    byte_size=inspected.byte_size,
                    sha256=inspected.sha256,
                )
            )
        return metas
