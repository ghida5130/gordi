from __future__ import annotations

import json
from pathlib import Path

import pytest

from garment_collector.adapters.base import SourceAdapter
from garment_collector.adapters.musinsa.parser import (
    classify_slot,
    map_backend_codes,
)
from garment_collector.cli import _load_expected_counts
from garment_collector.config import CollectorSettings
from garment_collector.models import (
    BackendCategory,
    BackendSubcategory,
    ParsedProduct,
    Slot,
)
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


@pytest.mark.parametrize(
    ("subcategory", "expected_subcategory"),
    [
        ("코트", BackendSubcategory.COAT),
        ("가디건", BackendSubcategory.CARDIGAN),
        ("패딩", BackendSubcategory.PADDING),
        ("블루종", BackendSubcategory.JACKET),
    ],
)
def test_outer_maps_to_top_by_team_rule(
    subcategory: str,
    expected_subcategory: BackendSubcategory,
) -> None:
    category, backend_subcategory = map_backend_codes(
        Slot.OUTER,
        "아우터",
        subcategory,
    )

    assert category is BackendCategory.TOP
    assert backend_subcategory is expected_subcategory


def test_skirt_bottom_and_dress_top_team_rules() -> None:
    skirt_slot, skirt_note = classify_slot("스커트", "", "미니 스커트")
    dress_slot, dress_note = classify_slot("원피스", "", "셔츠 원피스")

    assert skirt_slot is Slot.BOTTOM
    assert "BOTTOM" in (skirt_note or "")
    assert dress_slot is Slot.TOP
    assert "TOP" in (dress_note or "")
