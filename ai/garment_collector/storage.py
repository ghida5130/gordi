"""Dataset directory layout per collection policy §9."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from garment_collector.models import GarmentRecord


class DatasetStorage:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.raw_root = root / "raw"
        self.images_root = root / "images"
        self.normalized_root = root / "normalized"
        self.reports_root = root / "reports"

    def ensure_layout(self) -> None:
        for path in (
            self.raw_root,
            self.images_root,
            self.normalized_root,
            self.reports_root,
        ):
            path.mkdir(parents=True, exist_ok=True)

    def product_raw_dir(self, source: str, product_id: str) -> Path:
        return self.raw_root / source.lower() / product_id

    def product_images_dir(self, source: str, product_id: str) -> Path:
        return self.images_root / source.lower() / product_id

    def normalized_path(self, source: str, product_id: str) -> Path:
        return self.normalized_root / source.lower() / f"{product_id}.json"

    def write_raw_metadata(
        self,
        source: str,
        product_id: str,
        payload: dict[str, Any],
        *,
        filename: str = "raw-metadata.json",
    ) -> Path:
        directory = self.product_raw_dir(source, product_id)
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / filename
        path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8",
        )
        return path

    def write_source_html(
        self, source: str, product_id: str, html: bytes
    ) -> Path:
        directory = self.product_raw_dir(source, product_id)
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / "source.html"
        path.write_bytes(html)
        return path

    def write_image(
        self,
        source: str,
        product_id: str,
        filename: str,
        content: bytes,
    ) -> Path:
        directory = self.product_images_dir(source, product_id)
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / filename
        path.write_bytes(content)
        return path

    def write_normalized(self, record: GarmentRecord) -> Path:
        source = record.source.name.lower()
        product_id = record.source.external_product_id
        path = self.normalized_path(source, product_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            record.model_dump_json(indent=2),
            encoding="utf-8",
        )
        return path

    def write_report(self, name: str, payload: dict[str, Any]) -> Path:
        self.reports_root.mkdir(parents=True, exist_ok=True)
        path = self.reports_root / name
        path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8",
        )
        return path

    def image_relative_path(
        self, source: str, product_id: str, filename: str
    ) -> str:
        return f"images/{source.lower()}/{product_id}/{filename}"

    @staticmethod
    def sha256_bytes(content: bytes) -> str:
        return hashlib.sha256(content).hexdigest()

    @staticmethod
    def sha256_text(text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    @staticmethod
    def canonical_json_bytes(payload: Any) -> bytes:
        """Return stable bytes used for raw-bundle and manifest hashes."""
        return json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8")

    @classmethod
    def sha256_json(cls, payload: Any) -> str:
        return cls.sha256_bytes(cls.canonical_json_bytes(payload))
