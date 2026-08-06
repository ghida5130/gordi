from __future__ import annotations

import pytest

import app.services.recommendation_pipeline as service
from app.recommendation.vector_index import VectorIndexError
from app.services.recommendation_pipeline import (
    RecommendationRuntimeError,
    get_catalog_index,
)


@pytest.fixture(autouse=True)
def reset_index_state(monkeypatch: pytest.MonkeyPatch):
    service._load_catalog_index.cache_clear()
    service._index_failure = None
    yield
    service._load_catalog_index.cache_clear()
    service._index_failure = None


def test_load_failure_is_not_retried_within_backoff(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = {"count": 0}

    def failing_load(_path):
        calls["count"] += 1
        raise VectorIndexError("product 1129 image_url is invalid")

    monkeypatch.setattr(
        service.CatalogVectorIndex,
        "load",
        staticmethod(failing_load),
    )

    # 첫 요청은 실제 로드를 시도하고, backoff 동안의 재요청은
    # 수백 MB 재파싱 없이 즉시 실패해 baseline 으로 강등돼야 한다
    # (2026-08-06 EC2 장애: 요청마다 재파싱 → Spring 타임아웃).
    for _ in range(3):
        with pytest.raises(
            RecommendationRuntimeError,
            match="image_url is invalid",
        ):
            get_catalog_index()

    assert calls["count"] == 1


def test_load_retries_after_backoff_expires(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = {"count": 0}

    def failing_load(_path):
        calls["count"] += 1
        raise VectorIndexError("boom")

    monkeypatch.setattr(
        service.CatalogVectorIndex,
        "load",
        staticmethod(failing_load),
    )
    clock = {"now": 1_000.0}
    monkeypatch.setattr(service.time, "monotonic", lambda: clock["now"])

    with pytest.raises(RecommendationRuntimeError):
        get_catalog_index()
    clock["now"] += service._INDEX_FAILURE_BACKOFF_SECONDS + 1
    service._load_catalog_index.cache_clear()
    with pytest.raises(RecommendationRuntimeError):
        get_catalog_index()

    assert calls["count"] == 2
