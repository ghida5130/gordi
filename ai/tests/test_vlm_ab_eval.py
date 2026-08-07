from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import app.api.routes.recommendation_demo as demo_routes
from app.api.dependencies import require_recommendation_demo
from app.core.config import Settings, get_settings
from app.main import app
from app.recommendation.vlm_ab_eval import (
    VlmAbJudgment,
    append_judgment,
    load_judgments,
    summarize_judgments,
)
from tests.test_recommendation_demo import FakePipeline
from tests.test_tpo_eval import write_query_set

client = TestClient(app)


def make_judgment(
    *,
    evaluator: str = "임효민",
    query_id: str = "tpo-a",
    preferred: str = "VLM_ON",
    latency_on_ms: int = 9000,
    latency_off_ms: int = 1200,
) -> VlmAbJudgment:
    return VlmAbJudgment(
        evaluator=evaluator,
        query_id=query_id,
        preferred=preferred,
        index_version="a" * 64,
        latency_on_ms=latency_on_ms,
        latency_off_ms=latency_off_ms,
        judged_at="2026-08-06T00:00:00+00:00",
    )


def test_summary_counts_wins_and_supersedes_revote(
    tmp_path: Path,
) -> None:
    path = tmp_path / "ab.jsonl"
    append_judgment(path, make_judgment(preferred="VLM_OFF"))
    # 같은 (평가자, 쿼리) 재투표는 마지막 것이 이긴다.
    append_judgment(path, make_judgment(preferred="VLM_ON"))
    append_judgment(
        path,
        make_judgment(evaluator="한승민", preferred="TIE"),
    )
    append_judgment(
        path,
        make_judgment(
            evaluator="한승민",
            query_id="tpo-b",
            preferred="VLM_ON",
        ),
    )

    summary = summarize_judgments(
        load_judgments(path), ["tpo-a", "tpo-b"]
    )

    assert summary["votes"] == 3
    assert summary["on_wins"] == 2
    assert summary["off_wins"] == 0
    assert summary["ties"] == 1
    assert summary["on_win_rate"] == 1.0
    assert summary["mean_latency_on_ms"] == 9000
    assert summary["evaluators"] == ["임효민", "한승민"]


@pytest.fixture
def vlm_ab_api(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[Path]:
    queries_path = tmp_path / "queries.jsonl"
    write_query_set(queries_path, ["tpo-a", "tpo-b"])
    judgments_path = tmp_path / "ab.jsonl"
    settings = Settings(
        enable_recommendation_demo=True,
        vlm_ab_queries_path=queries_path,
        vlm_ab_judgments_path=judgments_path,
    )
    app.dependency_overrides[require_recommendation_demo] = (
        lambda: None
    )
    app.dependency_overrides[get_settings] = lambda: settings
    pipelines = {True: FakePipeline(), False: FakePipeline()}
    monkeypatch.setattr(
        demo_routes,
        "get_ab_pipeline",
        lambda rerank_enabled: pipelines[rerank_enabled],
    )
    yield judgments_path
    app.dependency_overrides.clear()


def test_vlm_ab_run_returns_blinded_pair(vlm_ab_api: Path) -> None:
    page = client.get("/demo/vlm-ab")
    response = client.post(
        "/api/v1/demo/vlm-ab/run",
        json={"queryId": "tpo-a"},
    )

    assert page.status_code == 200
    assert "VLM 리랭크 A/B 평가" in page.text
    assert response.status_code == 200, response.text
    body = response.json()
    assert [arm["label"] for arm in body["arms"]] == ["A", "B"]
    assert sorted(body["assignment"].values()) == [
        "VLM_OFF",
        "VLM_ON",
    ]
    assert all(arm["results"] for arm in body["arms"])
    assert body["latencyOnMs"] >= 0
    assert body["latencyOffMs"] >= 0


def test_vlm_ab_judgment_roundtrip_and_summary(
    vlm_ab_api: Path,
) -> None:
    saved = client.post(
        "/api/v1/demo/vlm-ab/judgments",
        json={
            "evaluator": "임효민",
            "queryId": "tpo-a",
            "preferred": "VLM_ON",
            "indexVersion": "a" * 64,
            "latencyOnMs": 9000,
            "latencyOffMs": 1200,
        },
    )
    summary = client.get("/api/v1/demo/vlm-ab/summary")

    assert saved.status_code == 200
    assert saved.json() == {"saved": 1}
    rows = [
        json.loads(line)
        for line in vlm_ab_api.read_text(
            encoding="utf-8"
        ).splitlines()
    ]
    assert len(rows) == 1
    assert rows[0]["preferred"] == "VLM_ON"
    body = summary.json()
    assert body["on_wins"] == 1
    assert body["on_win_rate"] == 1.0


def test_vlm_ab_rejects_unknown_query_and_bad_preference(
    vlm_ab_api: Path,
) -> None:
    unknown = client.post(
        "/api/v1/demo/vlm-ab/run",
        json={"queryId": "nope"},
    )
    bad_pref = client.post(
        "/api/v1/demo/vlm-ab/judgments",
        json={
            "evaluator": "임효민",
            "queryId": "tpo-a",
            "preferred": "BOTH",
            "indexVersion": "a" * 64,
            "latencyOnMs": 0,
            "latencyOffMs": 0,
        },
    )

    assert unknown.status_code == 422
    assert bad_pref.status_code == 422
    assert not vlm_ab_api.exists()
