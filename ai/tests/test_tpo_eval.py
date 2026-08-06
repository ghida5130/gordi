from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import require_recommendation_demo
from app.core.config import AI_ROOT, Settings, get_settings
from app.main import app
from app.recommendation.tpo_eval import (
    TpoEvalError,
    TpoJudgment,
    append_judgments,
    load_judgments,
    load_tpo_queries,
    summarize_judgments,
)

client = TestClient(app)

SHIPPED_QUERY_SET = AI_ROOT / "eval" / "queries-tpo-v1.jsonl"


def make_judgment(
    *,
    evaluator: str = "임효민",
    query_id: str = "tpo-a",
    product_id: int = 1,
    rank: int = 1,
    fit: str = "FIT",
) -> TpoJudgment:
    return TpoJudgment(
        evaluator=evaluator,
        query_id=query_id,
        product_id=product_id,
        rank=rank,
        fit=fit,
        index_version="a" * 64,
        judged_at="2026-08-05T00:00:00+00:00",
    )


def write_query_set(path: Path, query_ids: list[str]) -> None:
    lines = [
        json.dumps(
            {
                "schema_version": "recommendation-tpo-eval-v1",
                "query_id": query_id,
                "text": f"{query_id} 상황에 어울리는 옷",
                "moods": ["CASUAL"],
                "filters": {
                    "gender": "MALE",
                    "category": "TOP",
                    "subcategory": None,
                    "budget_min": 0,
                    "budget_max": None,
                },
                "label_source": "human",
            },
            ensure_ascii=False,
        )
        for query_id in query_ids
    ]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def test_shipped_query_set_is_valid() -> None:
    queries = load_tpo_queries(SHIPPED_QUERY_SET)

    assert len(queries) >= 20
    genders = {query.filters["gender"] for query in queries}
    assert genders == {"MALE", "FEMALE"}
    for query in queries:
        assert query.text.strip()
        assert query.filters["category"] in ("TOP", "BOTTOM")
        assert query.label_source == "human"


def test_load_rejects_duplicate_query_ids(tmp_path: Path) -> None:
    path = tmp_path / "queries.jsonl"
    write_query_set(path, ["tpo-a", "tpo-a"])

    with pytest.raises(TpoEvalError, match="duplicate"):
        load_tpo_queries(path)


def test_load_rejects_unknown_schema(tmp_path: Path) -> None:
    path = tmp_path / "queries.jsonl"
    path.write_text(
        json.dumps({"schema_version": "other", "query_id": "x"}),
        encoding="utf-8",
    )

    with pytest.raises(TpoEvalError, match="schema"):
        load_tpo_queries(path)


def test_judgment_append_and_load_roundtrip(tmp_path: Path) -> None:
    path = tmp_path / "judgments" / "tpo-v1.jsonl"
    first = make_judgment(product_id=1)
    second = make_judgment(product_id=2, fit="UNFIT")

    assert append_judgments(path, [first]) == 1
    assert append_judgments(path, [second]) == 1
    assert load_judgments(path) == [first, second]


def test_load_judgments_missing_file_is_empty(tmp_path: Path) -> None:
    assert load_judgments(tmp_path / "absent.jsonl") == []


def test_summary_excludes_unsure_and_supersedes_rejudgment(
    tmp_path: Path,
) -> None:
    queries_path = tmp_path / "queries.jsonl"
    write_query_set(queries_path, ["tpo-a", "tpo-b"])
    queries = load_tpo_queries(queries_path)
    judgments = [
        make_judgment(product_id=1, fit="UNFIT"),
        # 같은 (평가자, 쿼리, 상품)을 다시 판정하면 마지막 기록이 이긴다.
        make_judgment(product_id=1, fit="FIT"),
        make_judgment(product_id=2, fit="UNFIT"),
        make_judgment(product_id=3, fit="UNSURE"),
        make_judgment(
            evaluator="한승민",
            query_id="tpo-b",
            product_id=9,
            fit="FIT",
        ),
        make_judgment(
            query_id="tpo-unknown",
            product_id=99,
            fit="FIT",
        ),
    ]

    summary = summarize_judgments(judgments, queries)

    assert summary["query_count"] == 2
    assert summary["judged_query_count"] == 2
    # tpo-a: FIT 1 / UNFIT 1 (UNSURE 제외) = 0.5, tpo-b: 1.0
    assert summary["macro_fit_rate"] == 0.75
    assert summary["micro_fit_rate"] == round(2 / 3, 4)
    assert summary["counts"] == {"fit": 2, "unfit": 1, "unsure": 1}
    assert summary["evaluators"]["임효민"]["judged_queries"] == 1
    assert summary["evaluators"]["임효민"]["remaining_queries"] == 1


@pytest.fixture
def tpo_eval_api(tmp_path: Path) -> Iterator[Path]:
    queries_path = tmp_path / "queries.jsonl"
    write_query_set(queries_path, ["tpo-a", "tpo-b"])
    judgments_path = tmp_path / "judgments" / "tpo-v1.jsonl"
    settings = Settings(
        enable_recommendation_demo=True,
        tpo_eval_queries_path=queries_path,
        tpo_eval_judgments_path=judgments_path,
    )
    app.dependency_overrides[require_recommendation_demo] = (
        lambda: None
    )
    app.dependency_overrides[get_settings] = lambda: settings
    yield judgments_path
    app.dependency_overrides.clear()


def test_tpo_eval_page_and_queries_api(
    tpo_eval_api: Path,
) -> None:
    page = client.get("/demo/tpo-eval")
    queries = client.get("/api/v1/demo/tpo-eval/queries")

    assert page.status_code == 200
    assert "TPO 적합 평가" in page.text
    assert queries.status_code == 200
    payload = queries.json()
    assert [item["queryId"] for item in payload["queries"]] == [
        "tpo-a",
        "tpo-b",
    ]
    assert payload["queries"][0]["gender"] == "MALE"


def test_tpo_eval_saves_judgments_and_summarizes(
    tpo_eval_api: Path,
) -> None:
    submission = {
        "evaluator": "임효민",
        "queryId": "tpo-a",
        "indexVersion": "a" * 64,
        "judgments": [
            {"productId": 1, "rank": 1, "fit": "FIT"},
            {"productId": 2, "rank": 2, "fit": "UNFIT"},
        ],
    }

    saved = client.post(
        "/api/v1/demo/tpo-eval/judgments",
        json=submission,
    )
    summary = client.get("/api/v1/demo/tpo-eval/summary")

    assert saved.status_code == 200
    assert saved.json() == {"saved": 2}
    stored = load_judgments(tpo_eval_api)
    assert len(stored) == 2
    assert stored[0].judged_at
    assert summary.status_code == 200
    body = summary.json()
    assert body["macro_fit_rate"] == 0.5
    assert body["counts"] == {"fit": 1, "unfit": 1, "unsure": 0}


def test_tpo_eval_rejects_unknown_query_id(
    tpo_eval_api: Path,
) -> None:
    response = client.post(
        "/api/v1/demo/tpo-eval/judgments",
        json={
            "evaluator": "임효민",
            "queryId": "tpo-nope",
            "indexVersion": "a" * 64,
            "judgments": [
                {"productId": 1, "rank": 1, "fit": "FIT"}
            ],
        },
    )

    assert response.status_code == 422
    assert not tpo_eval_api.exists()


def test_tpo_eval_rejects_invalid_fit_value(
    tpo_eval_api: Path,
) -> None:
    response = client.post(
        "/api/v1/demo/tpo-eval/judgments",
        json={
            "evaluator": "임효민",
            "queryId": "tpo-a",
            "indexVersion": "a" * 64,
            "judgments": [
                {"productId": 1, "rank": 1, "fit": "MAYBE"}
            ],
        },
    )

    assert response.status_code == 422


def test_tpo_eval_hidden_when_demo_disabled() -> None:
    settings = Settings(enable_recommendation_demo=False)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        page = client.get("/demo/tpo-eval")
        queries = client.get("/api/v1/demo/tpo-eval/queries")
    finally:
        app.dependency_overrides.clear()

    assert page.status_code == 404
    assert queries.status_code == 404
