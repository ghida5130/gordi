from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.recommendation.evaluation import (
    EVAL_DATASET_SCHEMA_VERSION,
    EvalQuery,
    EvaluationError,
    OfflineProductQueryRetriever,
    brand_diversity_at_k,
    evaluate_queries,
    generate_seed_queries,
    load_eval_queries,
    ndcg_at_k,
    pairwise_accuracy,
    product_key,
    recall_at_k,
)
from app.recommendation.catalog import CatalogProduct
from app.recommendation.pipeline import (
    RecommendationPipeline,
    RecommendationResult,
)
from app.recommendation.vector_index import (
    CatalogVectorIndex,
    SearchFilters,
)
from tests.test_vector_index import build_index, vector


def make_query(**overrides: Any) -> EvalQuery:
    base: dict[str, Any] = {
        "query_id": "q1",
        "text": "블랙 반팔티",
        "query_product_key": None,
        "filters": SearchFilters(gender="MALE"),
        "relevant": {"MUSINSA:1": 2, "MUSINSA:2": 1},
        "pairs": (("MUSINSA:1", "MUSINSA:2"),),
        "label_source": "heuristic",
    }
    base.update(overrides)
    return EvalQuery(**base)


def result(key: str, rank: int) -> RecommendationResult:
    source, _, external_id = key.partition(":")
    return RecommendationResult(
        product_id=int(external_id),
        rank=rank,
        score=1.0 - rank * 0.01,
        retrieval_score=0.9,
        compatibility_score=0.8,
        reason="근거",
        product={
            "product_id": int(external_id),
            "source": source,
            "external_id": external_id,
            "brand": f"브랜드{int(external_id) % 2}",
        },
    )


def test_recall_at_k_counts_relevant_hits() -> None:
    ranked = ["MUSINSA:1", "MUSINSA:9", "MUSINSA:2"]
    relevant = {"MUSINSA:1": 2, "MUSINSA:2": 1, "MUSINSA:3": 1}

    assert recall_at_k(ranked, relevant, 2) == pytest.approx(1 / 3)
    assert recall_at_k(ranked, relevant, 3) == pytest.approx(2 / 3)
    assert recall_at_k(ranked, {}, 3) is None


def test_ndcg_at_k_prefers_higher_grades_first() -> None:
    relevant = {"MUSINSA:1": 2, "MUSINSA:2": 1}
    ideal = ndcg_at_k(["MUSINSA:1", "MUSINSA:2"], relevant, 2)
    swapped = ndcg_at_k(["MUSINSA:2", "MUSINSA:1"], relevant, 2)

    assert ideal == pytest.approx(1.0)
    assert swapped is not None and swapped < 1.0


def test_pairwise_accuracy_handles_missing_items() -> None:
    ranked = ["MUSINSA:1", "MUSINSA:2"]
    outcome = pairwise_accuracy(
        ranked,
        [
            ("MUSINSA:1", "MUSINSA:2"),
            ("MUSINSA:2", "MUSINSA:1"),
            ("MUSINSA:1", "MUSINSA:404"),
            ("MUSINSA:404", "MUSINSA:1"),
            ("MUSINSA:404", "MUSINSA:405"),
        ],
    )

    assert outcome.evaluated == 4
    assert outcome.skipped == 1
    assert outcome.accuracy == pytest.approx(2 / 4)


def test_brand_diversity_at_k() -> None:
    products = [
        {"brand": "가"},
        {"brand": "가"},
        {"brand": "나"},
    ]

    assert brand_diversity_at_k(products, 3) == pytest.approx(2 / 3)
    assert brand_diversity_at_k([], 5) is None


def test_evaluate_queries_aggregates_metrics_and_latency() -> None:
    query = make_query()

    def run_query(_: EvalQuery) -> list[RecommendationResult]:
        return [result("MUSINSA:1", 1), result("MUSINSA:2", 2)]

    report = evaluate_queries(run_query, [query], ks=(2,))

    assert report["query_count"] == 1
    aggregate = report["aggregate"]
    assert aggregate["recall@2"] == pytest.approx(1.0)
    assert aggregate["ndcg@2"] == pytest.approx(1.0)
    assert aggregate["pairwise_accuracy"] == pytest.approx(1.0)
    assert aggregate["latency_mean_seconds"] >= 0.0
    assert report["per_query"][0]["returned"] == 2


def test_load_eval_queries_round_trip(tmp_path: Path) -> None:
    line = {
        "schema_version": EVAL_DATASET_SCHEMA_VERSION,
        "query_id": "q1",
        "text": "블랙 반팔티",
        "query_product_key": "MUSINSA:1",
        "filters": {
            "gender": "MALE",
            "category": "TOP",
            "subcategory": None,
            "budget_min": 0,
            "budget_max": None,
        },
        "relevant": {"MUSINSA:2": 2},
        "pairs": [["MUSINSA:2", "MUSINSA:3"]],
        "label_source": "heuristic",
    }
    dataset = tmp_path / "queries.jsonl"
    dataset.write_text(
        json.dumps(line, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    queries = load_eval_queries(dataset)

    assert queries[0].query_id == "q1"
    assert queries[0].relevant == {"MUSINSA:2": 2}
    assert queries[0].pairs == (("MUSINSA:2", "MUSINSA:3"),)


@pytest.mark.parametrize(
    ("mutation", "message"),
    [
        ({"schema_version": "nope"}, "schema_version"),
        ({"relevant": {}}, "relevant"),
        ({"label_source": "guess"}, "label_source"),
        ({"pairs": [["MUSINSA:1", "MUSINSA:1"]]}, "pair"),
    ],
)
def test_load_eval_queries_rejects_invalid_lines(
    tmp_path: Path,
    mutation: dict[str, Any],
    message: str,
) -> None:
    line = {
        "schema_version": EVAL_DATASET_SCHEMA_VERSION,
        "query_id": "q1",
        "text": "블랙 반팔티",
        "filters": {"gender": "MALE"},
        "relevant": {"MUSINSA:2": 2},
        "pairs": [],
        "label_source": "heuristic",
    }
    line.update(mutation)
    dataset = tmp_path / "queries.jsonl"
    dataset.write_text(
        json.dumps(line, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    with pytest.raises(EvaluationError, match=message):
        load_eval_queries(dataset)


def colored_product(
    product_id: int,
    name: str,
    *,
    gender: str = "MALE",
) -> CatalogProduct:
    return CatalogProduct(
        product_id=product_id,
        source="MUSINSA",
        external_id=str(3_000_000 + product_id),
        name=name,
        brand=f"브랜드{product_id % 2}",
        gender=gender,
        price=50_000,
        category="TOP",
        subcategory="SHORT_SLEEVE",
        image_url=f"https://images.internal/{product_id}.jpg",
        purchase_url=f"https://shop.example/{product_id}",
        description="캐주얼 의류",
        currency="KRW",
        availability="AVAILABLE",
    )


def _snapshot_index(tmp_path: Path) -> CatalogVectorIndex:
    products = [
        colored_product(1, "블랙 반팔티"),
        colored_product(2, "블랙 라운드 반팔티"),
        colored_product(3, "화이트 반팔티"),
        colored_product(4, "블루 반팔티"),
    ]
    vectors = {
        1: vector(1.0, 0.0),
        2: vector(0.9, 0.1),
        3: vector(0.5, 0.5),
        4: vector(0.1, 0.9),
    }
    _, index = build_index(tmp_path, products, vectors)
    return index


def test_offline_retriever_excludes_query_product(
    tmp_path: Path,
) -> None:
    index = _snapshot_index(tmp_path)
    anchor = index.products[0]
    retriever = OfflineProductQueryRetriever(index)
    retriever.use_query_product(product_key(anchor))

    hits = retriever.retrieve(
        text=None,
        image=None,
        mime_type=None,
        filters=SearchFilters(gender="MALE"),
        limit=10,
    )

    assert hits
    assert all(
        product_key(hit.product) != product_key(anchor)
        for hit in hits
    )


def test_offline_retriever_rejects_unknown_product(
    tmp_path: Path,
) -> None:
    index = _snapshot_index(tmp_path)
    retriever = OfflineProductQueryRetriever(index)

    with pytest.raises(EvaluationError, match="not in the vector index"):
        retriever.use_query_product("MUSINSA:404404")


def test_generate_seed_queries_is_deterministic_and_valid(
    tmp_path: Path,
) -> None:
    index = _snapshot_index(tmp_path)

    first = generate_seed_queries(index, min_group_size=2)
    second = generate_seed_queries(index, min_group_size=2)

    assert first == second
    assert first
    for query in first:
        assert query["schema_version"] == EVAL_DATASET_SCHEMA_VERSION
        assert query["label_source"] == "heuristic"
        assert query["relevant"]
        assert query["query_product_key"] not in query["relevant"]


def test_offline_pipeline_end_to_end_reports_metrics(
    tmp_path: Path,
) -> None:
    index = _snapshot_index(tmp_path)
    seed = generate_seed_queries(index, min_group_size=2)
    dataset = tmp_path / "seed.jsonl"
    dataset.write_text(
        "\n".join(
            json.dumps(query, ensure_ascii=False) for query in seed
        )
        + "\n",
        encoding="utf-8",
    )
    queries = load_eval_queries(dataset)
    retriever = OfflineProductQueryRetriever(index)
    pipeline = RecommendationPipeline(
        retriever,
        index_version=index.snapshot_sha256,
    )

    def run_query(query: EvalQuery) -> list[RecommendationResult]:
        assert query.query_product_key is not None
        retriever.use_query_product(query.query_product_key)
        return pipeline.recommend(
            text=query.text,
            image=None,
            mime_type=None,
            filters=query.filters,
            candidate_limit=50,
            result_limit=10,
        )

    report = evaluate_queries(run_query, queries)

    assert report["query_count"] == len(queries)
    assert report["aggregate"]["recall@10"] is not None
