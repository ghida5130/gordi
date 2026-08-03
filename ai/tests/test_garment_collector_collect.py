from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest

from garment_collector.adapters.base import SourceAdapter
from garment_collector.adapters.musinsa.adapter import MusinsaAdapter
from garment_collector.adapters.musinsa.parser import (
    classify_slot,
    map_backend_codes,
    sizes_available_without_options,
)
from garment_collector.cli import _load_expected_counts
from garment_collector.config import (
    PRODUCT_REQUEST_DELAY_SEC,
    CollectorSettings,
)
from garment_collector.http_client import FetchResult
from garment_collector.models import (
    BackendCategory,
    BackendSubcategory,
    ParsedProduct,
    Slot,
)
from garment_collector.pipeline import CollectionPipeline
from garment_collector.rate_limit import RateLimiter
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


def test_outer_subcategories_are_valid_under_top() -> None:
    from garment_collector.validate import _BACKEND_SUBCATEGORIES

    assert {
        BackendSubcategory.JACKET,
        BackendSubcategory.COAT,
        BackendSubcategory.CARDIGAN,
        BackendSubcategory.PADDING,
    } <= _BACKEND_SUBCATEGORIES[BackendCategory.TOP]


def test_skirt_bottom_and_dress_top_team_rules() -> None:
    skirt_slot, skirt_note = classify_slot("스커트", "", "미니 스커트")
    dress_slot, dress_note = classify_slot("원피스", "", "셔츠 원피스")

    assert skirt_slot is Slot.BOTTOM
    assert "BOTTOM" in (skirt_note or "")
    assert dress_slot is Slot.TOP
    assert "TOP" in (dress_note or "")


def test_settings_allow_unlimited_max_items(tmp_path: Path) -> None:
    settings = CollectorSettings(dataset_root=tmp_path)
    assert settings.max_items is None


def test_settings_reject_product_delay_below_floor(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="product_delay_sec"):
        CollectorSettings(
            dataset_root=tmp_path,
            product_delay_sec=PRODUCT_REQUEST_DELAY_SEC - 0.1,
        )


def test_pipeline_accepts_more_than_legacy_pilot_cap(tmp_path: Path) -> None:
    """Run-cap removed: large id lists are accepted when max_items is None."""
    ids = [str(i) for i in range(250)]
    settings = CollectorSettings(
        dataset_root=tmp_path,
        skip_existing=True,
        dry_run=True,
    )
    # dry_run still walks ids; no pre-existing files → status skipped dry_run
    report = CollectionPipeline(settings, ExplodingAdapter()).run(ids)
    assert report.requested == 250
    assert report.skipped == 250


def test_rate_limiter_touch_does_not_sleep() -> None:
    limiter = RateLimiter(0.5)
    limiter.wait()
    started = time.monotonic()
    limiter.touch()
    limiter.touch()
    elapsed = time.monotonic() - started
    assert elapsed < 0.2


def test_rate_limiter_wait_after_touch_respects_interval() -> None:
    limiter = RateLimiter(0.15)
    limiter.touch()
    started = time.monotonic()
    limiter.wait()
    elapsed = time.monotonic() - started
    assert elapsed >= 0.12


def test_sizes_available_without_options_from_actual_size() -> None:
    detail = {"data": {"goodsNm": "tee"}}
    actual = {
        "data": {
            "sizes": [
                {
                    "name": "M",
                    "items": [{"name": "총장", "value": "70"}],
                }
            ]
        }
    }
    assert sizes_available_without_options(detail, actual) is True
    assert sizes_available_without_options(detail, None) is False


def test_fetch_product_skips_options_when_actual_size_present() -> None:
    adapter = MusinsaAdapter()
    detail_body = json.dumps(
        {
            "data": {
                "goodsNo": 1,
                "goodsNm": "테스트 셔츠",
                "brandInfo": {"brandName": "TEST"},
                "gender": "MALE",
                "category": {
                    "categoryDepth1Name": "상의",
                    "categoryDepth2Name": "셔츠",
                },
                "goodsPrice": {"salePrice": 10000, "normalPrice": 12000},
                "thumbnailImageUrl": "https://example.com/a.jpg",
            }
        }
    ).encode("utf-8")
    actual_body = json.dumps(
        {
            "data": {
                "sizes": [
                    {
                        "name": "M",
                        "items": [
                            {"name": "총장", "value": "70"},
                            {"name": "어깨너비", "value": "45"},
                            {"name": "가슴단면", "value": "50"},
                        ],
                    }
                ]
            }
        }
    ).encode("utf-8")

    calls: list[tuple[str, bool]] = []

    def fake_get(url: str, *, pace: bool = True) -> FetchResult:
        calls.append((url, pace))
        if "actual-size" in url:
            body = actual_body
        elif "options" in url:
            raise AssertionError("options must be skipped when sizes exist")
        else:
            body = detail_body
        return FetchResult(
            url=url,
            status_code=200,
            content=body,
            content_type="application/json",
            final_url=url,
        )

    client = MagicMock()
    client.get.side_effect = fake_get

    parsed, raw_bundle, _ = adapter.fetch_product("999001", client)

    assert parsed.name == "테스트 셔츠"
    assert raw_bundle.get("options_skipped") is True
    assert raw_bundle.get("options") is None
    urls = [u for u, _ in calls]
    assert any("actual-size" in u for u in urls)
    assert not any("options" in u for u in urls)
    # first call paced, secondary unpaced
    assert calls[0][1] is True
    assert all(pace is False for _, pace in calls[1:])


def test_fetch_product_requests_options_when_no_sizes() -> None:
    adapter = MusinsaAdapter()
    detail_body = json.dumps(
        {
            "data": {
                "goodsNo": 2,
                "goodsNm": "사이즈없는 상품",
                "brandInfo": {"brandName": "TEST"},
                "gender": "FEMALE",
                "category": {
                    "categoryDepth1Name": "상의",
                    "categoryDepth2Name": "티셔츠",
                },
                "goodsPrice": {"salePrice": 9000},
                "thumbnailImageUrl": "https://example.com/b.jpg",
            }
        }
    ).encode("utf-8")
    empty_actual = json.dumps({"data": {"sizes": []}}).encode("utf-8")
    options_body = json.dumps(
        {
            "data": {
                "optionItems": [
                    {"name": "FREE", "value": "FREE"},
                ]
            }
        }
    ).encode("utf-8")

    def fake_get(url: str, *, pace: bool = True) -> FetchResult:
        if "actual-size" in url:
            body = empty_actual
        elif "options" in url:
            body = options_body
        else:
            body = detail_body
        return FetchResult(
            url=url,
            status_code=200,
            content=body,
            content_type="application/json",
            final_url=url,
        )

    client = MagicMock()
    client.get.side_effect = fake_get

    _parsed, raw_bundle, _ = adapter.fetch_product("999002", client)

    assert raw_bundle.get("options_skipped") is False
    assert raw_bundle.get("options") is not None
    assert client.get.call_count == 3
