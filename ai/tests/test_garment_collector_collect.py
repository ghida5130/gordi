from __future__ import annotations

import json
from pathlib import Path

import pytest

from garment_collector.adapters.base import SourceAdapter
from garment_collector.cli import _load_expected_counts
from garment_collector.config import CollectorSettings
from garment_collector.models import ParsedProduct
from garment_collector.pipeline import CollectionPipeline
from garment_collector.seed_manifest import ManifestError


class ExplodingAdapter(SourceAdapter):
    """Any network-facing call is a test failure."""

    name = "MUSINSA"

    def product_url(self, product_id: str) -> str:
        return f"https://www.musinsa.com/products/{product_id}"

    def parse_product_html(
        self, product_id: str, product_url: str, html: bytes
    ) -> ParsedProduct:
        raise AssertionError("parse_product_html must not be called")

    def fetch_product(self, product_id: str, client: object) -> tuple:
        raise AssertionError("fetch_product must not be called")


def test_collect_skip_existing_avoids_refetch(tmp_path: Path) -> None:
    dataset_root = tmp_path / "dataset"
    normalized = dataset_root / "normalized" / "musinsa" / "111.json"
    normalized.parent.mkdir(parents=True)
    normalized.write_text("{}", encoding="utf-8")

    settings = CollectorSettings(
        dataset_root=dataset_root,
        skip_existing=True,
        dry_run=False,
    )
    pipeline = CollectionPipeline(settings, ExplodingAdapter())

    report = pipeline.run(["111"])

    assert report.skipped == 1
    assert report.failed == 0
    assert report.outcomes[0].status == "skipped"
    assert report.outcomes[0].error == "already collected"


def test_collect_without_skip_existing_would_fetch(tmp_path: Path) -> None:
    dataset_root = tmp_path / "dataset"
    normalized = dataset_root / "normalized" / "musinsa" / "111.json"
    normalized.parent.mkdir(parents=True)
    normalized.write_text("{}", encoding="utf-8")

    settings = CollectorSettings(
        dataset_root=dataset_root,
        skip_existing=False,
    )
    pipeline = CollectionPipeline(settings, ExplodingAdapter())

    report = pipeline.run(["111"])

    assert report.failed == 1
    assert "must not be called" in (report.outcomes[0].error or "")


def test_load_expected_counts_round_trip(tmp_path: Path) -> None:
    path = tmp_path / "counts.json"
    path.write_text(
        json.dumps({"MALE/TOP": 100, "FEMALE/BOTTOM": 100}),
        encoding="utf-8",
    )

    assert _load_expected_counts(path) == {
        "MALE/TOP": 100,
        "FEMALE/BOTTOM": 100,
    }


@pytest.mark.parametrize(
    "payload",
    [[], {}, {"MALE/TOP": 0}, {"MALE/TOP": "many"}, {"MALE/TOP": True}],
)
def test_load_expected_counts_rejects_invalid(
    tmp_path: Path,
    payload: object,
) -> None:
    path = tmp_path / "counts.json"
    path.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(ManifestError):
        _load_expected_counts(path)
