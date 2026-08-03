"""Evaluation harness: labeled queries, ranking metrics, and reports.

The harness fixes a measurable baseline before pipeline changes, as the
handoff requires: retrieval recall@K, nDCG@K, pairwise accuracy, brand
diversity, and latency for one dataset of labeled queries.

Two execution modes share the same dataset schema:

- offline: the query embedding is the anchor product's own snapshot
  embedding (leave-one-out). Deterministic and free of API calls, so it
  can run in CI and gives comparable numbers across pipeline changes.
- live: the query text (and optional image) is embedded through the
  configured OpenRouter provider, matching production behaviour.

Seed labels are heuristic (metadata-derived) placeholders. They are good
enough to detect regressions, but human pair/ranking labels must replace
them before tuning score weights.
"""

from __future__ import annotations

import json
import math
import random
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Sequence

from app.recommendation.pipeline import (
    _COLOR_LABELS,
    _SEASON_LABELS,
    RecommendationResult,
    infer_product_tags,
)
from app.recommendation.vector_index import (
    CatalogVectorIndex,
    SearchFilters,
    SearchHit,
)

EVAL_DATASET_SCHEMA_VERSION = "recommendation-eval-v1"
DEFAULT_METRIC_KS = (5, 10)

_SUBCATEGORY_QUERY_LABELS = {
    "SHIRT": "셔츠",
    "SHORT_SLEEVE": "반팔티",
    "LONG_SLEEVE": "긴팔티",
    "KNIT": "니트",
    "HOODIE": "후드티",
    "SLEEVELESS": "민소매",
    "SPORTS_TOP": "스포츠 상의",
    "OTHER_TOP": "상의",
    "DRESS": "원피스",
    "DENIM_PANTS": "데님 팬츠",
    "SLACKS": "슬랙스",
    "COTTON_PANTS": "코튼 팬츠",
    "JOGGER_PANTS": "조거 팬츠",
    "SHORTS": "반바지",
    "SPORTS_BOTTOM": "스포츠 하의",
    "OTHER_BOTTOM": "하의",
}


class EvaluationError(RuntimeError):
    """Raised when an evaluation dataset or run request is invalid."""


@dataclass(frozen=True)
class EvalQuery:
    query_id: str
    text: str | None
    query_product_key: str | None
    filters: SearchFilters
    relevant: dict[str, int]
    pairs: tuple[tuple[str, str], ...]
    label_source: str


@dataclass(frozen=True)
class PairwiseResult:
    accuracy: float | None
    evaluated: int
    skipped: int


@dataclass
class QueryMetrics:
    query_id: str
    latency_seconds: float
    recall: dict[int, float | None] = field(default_factory=dict)
    ndcg: dict[int, float | None] = field(default_factory=dict)
    pairwise: PairwiseResult = PairwiseResult(None, 0, 0)
    brand_diversity: float | None = None
    returned: int = 0


def product_key(product: dict[str, Any]) -> str:
    return f"{product['source']}:{product['external_id']}"


def load_eval_queries(path: Path) -> list[EvalQuery]:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        raise EvaluationError(
            f"cannot read eval dataset {path}: {exc}"
        ) from exc
    queries: list[EvalQuery] = []
    seen_ids: set[str] = set()
    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        try:
            raw = json.loads(line)
        except json.JSONDecodeError as exc:
            raise EvaluationError(
                f"line {line_number} is not valid JSON: {exc}"
            ) from exc
        queries.append(_parse_query(raw, line_number, seen_ids))
    if not queries:
        raise EvaluationError("eval dataset contains no queries")
    return queries


def _parse_query(
    raw: Any,
    line_number: int,
    seen_ids: set[str],
) -> EvalQuery:
    if not isinstance(raw, dict):
        raise EvaluationError(f"line {line_number} must be an object")
    if raw.get("schema_version") != EVAL_DATASET_SCHEMA_VERSION:
        raise EvaluationError(
            f"line {line_number} has an unsupported schema_version"
        )
    query_id = raw.get("query_id")
    if not isinstance(query_id, str) or not query_id.strip():
        raise EvaluationError(f"line {line_number} needs a query_id")
    if query_id in seen_ids:
        raise EvaluationError(f"duplicate query_id: {query_id}")
    seen_ids.add(query_id)
    text = raw.get("text")
    if text is not None and not isinstance(text, str):
        raise EvaluationError(f"{query_id}: text must be a string")
    query_product_key = raw.get("query_product_key")
    if query_product_key is not None and (
        not isinstance(query_product_key, str)
        or ":" not in query_product_key
    ):
        raise EvaluationError(
            f"{query_id}: query_product_key must look like SOURCE:ID"
        )
    if text is None and query_product_key is None:
        raise EvaluationError(
            f"{query_id}: needs text or query_product_key"
        )
    filters_raw = raw.get("filters")
    if not isinstance(filters_raw, dict):
        raise EvaluationError(f"{query_id}: filters must be an object")
    filters = SearchFilters(
        gender=str(filters_raw.get("gender", "")),
        category=filters_raw.get("category"),
        subcategory=filters_raw.get("subcategory"),
        budget_min=int(filters_raw.get("budget_min", 0)),
        budget_max=filters_raw.get("budget_max"),
    )
    filters.validate()
    relevant_raw = raw.get("relevant")
    if not isinstance(relevant_raw, dict) or not relevant_raw:
        raise EvaluationError(
            f"{query_id}: relevant must be a non-empty object"
        )
    relevant: dict[str, int] = {}
    for key, grade in relevant_raw.items():
        if (
            not isinstance(grade, int)
            or isinstance(grade, bool)
            or grade < 1
        ):
            raise EvaluationError(
                f"{query_id}: relevance grade for {key} must be >= 1"
            )
        relevant[str(key)] = grade
    pairs_raw = raw.get("pairs", [])
    if not isinstance(pairs_raw, list):
        raise EvaluationError(f"{query_id}: pairs must be an array")
    pairs: list[tuple[str, str]] = []
    for pair in pairs_raw:
        if (
            not isinstance(pair, (list, tuple))
            or len(pair) != 2
            or pair[0] == pair[1]
        ):
            raise EvaluationError(
                f"{query_id}: each pair must be [better, worse]"
            )
        pairs.append((str(pair[0]), str(pair[1])))
    label_source = raw.get("label_source")
    if label_source not in {"heuristic", "human"}:
        raise EvaluationError(
            f"{query_id}: label_source must be heuristic or human"
        )
    return EvalQuery(
        query_id=query_id,
        text=text,
        query_product_key=query_product_key,
        filters=filters,
        relevant=relevant,
        pairs=tuple(pairs),
        label_source=label_source,
    )


def recall_at_k(
    ranked: Sequence[str],
    relevant: dict[str, int],
    k: int,
) -> float | None:
    if k <= 0:
        raise EvaluationError("k must be positive")
    if not relevant:
        return None
    top = set(ranked[:k])
    hits = sum(1 for key in relevant if key in top)
    return hits / len(relevant)


def ndcg_at_k(
    ranked: Sequence[str],
    relevant: dict[str, int],
    k: int,
) -> float | None:
    if k <= 0:
        raise EvaluationError("k must be positive")
    if not relevant:
        return None
    dcg = 0.0
    for position, key in enumerate(ranked[:k], start=1):
        grade = relevant.get(key, 0)
        if grade > 0:
            dcg += (2**grade - 1) / math.log2(position + 1)
    ideal_grades = sorted(relevant.values(), reverse=True)[:k]
    ideal = sum(
        (2**grade - 1) / math.log2(position + 1)
        for position, grade in enumerate(ideal_grades, start=1)
    )
    if ideal == 0:
        return None
    return dcg / ideal


def pairwise_accuracy(
    ranked: Sequence[str],
    pairs: Sequence[tuple[str, str]],
) -> PairwiseResult:
    positions = {key: index for index, key in enumerate(ranked)}
    correct = 0
    evaluated = 0
    skipped = 0
    for better, worse in pairs:
        better_pos = positions.get(better)
        worse_pos = positions.get(worse)
        if better_pos is None and worse_pos is None:
            skipped += 1
            continue
        evaluated += 1
        if worse_pos is None or (
            better_pos is not None and better_pos < worse_pos
        ):
            correct += 1
    accuracy = correct / evaluated if evaluated else None
    return PairwiseResult(accuracy, evaluated, skipped)


def brand_diversity_at_k(
    products: Sequence[dict[str, Any]],
    k: int,
) -> float | None:
    top = products[:k]
    if not top:
        return None
    brands = {str(item.get("brand", "")) for item in top}
    return len(brands) / len(top)


def evaluate_queries(
    run_query: Callable[[EvalQuery], list[RecommendationResult]],
    queries: Sequence[EvalQuery],
    *,
    ks: Sequence[int] = DEFAULT_METRIC_KS,
) -> dict[str, Any]:
    if not queries:
        raise EvaluationError("no queries to evaluate")
    per_query: list[QueryMetrics] = []
    for query in queries:
        started = time.perf_counter()
        results = run_query(query)
        latency = time.perf_counter() - started
        ranked = [product_key(result.product) for result in results]
        metrics = QueryMetrics(
            query_id=query.query_id,
            latency_seconds=latency,
            returned=len(ranked),
        )
        for k in ks:
            metrics.recall[k] = recall_at_k(ranked, query.relevant, k)
            metrics.ndcg[k] = ndcg_at_k(ranked, query.relevant, k)
        metrics.pairwise = pairwise_accuracy(ranked, query.pairs)
        metrics.brand_diversity = brand_diversity_at_k(
            [result.product for result in results],
            max(ks),
        )
        per_query.append(metrics)
    return {
        "query_count": len(per_query),
        "aggregate": _aggregate(per_query, ks),
        "per_query": [_metrics_payload(item, ks) for item in per_query],
    }


def _aggregate(
    per_query: Sequence[QueryMetrics],
    ks: Sequence[int],
) -> dict[str, Any]:
    def mean(values: list[float]) -> float | None:
        return sum(values) / len(values) if values else None

    aggregate: dict[str, Any] = {}
    for k in ks:
        aggregate[f"recall@{k}"] = mean(
            [m.recall[k] for m in per_query if m.recall[k] is not None]
        )
        aggregate[f"ndcg@{k}"] = mean(
            [m.ndcg[k] for m in per_query if m.ndcg[k] is not None]
        )
    evaluated = sum(m.pairwise.evaluated for m in per_query)
    correct = sum(
        round(m.pairwise.accuracy * m.pairwise.evaluated)
        for m in per_query
        if m.pairwise.accuracy is not None
    )
    aggregate["pairwise_accuracy"] = (
        correct / evaluated if evaluated else None
    )
    aggregate["pairwise_evaluated"] = evaluated
    aggregate["pairwise_skipped"] = sum(
        m.pairwise.skipped for m in per_query
    )
    aggregate["brand_diversity"] = mean(
        [
            m.brand_diversity
            for m in per_query
            if m.brand_diversity is not None
        ]
    )
    latencies = sorted(m.latency_seconds for m in per_query)
    aggregate["latency_mean_seconds"] = mean(list(latencies))
    aggregate["latency_p95_seconds"] = latencies[
        min(len(latencies) - 1, math.ceil(0.95 * len(latencies)) - 1)
    ]
    return aggregate


def _metrics_payload(
    metrics: QueryMetrics,
    ks: Sequence[int],
) -> dict[str, Any]:
    return {
        "query_id": metrics.query_id,
        "returned": metrics.returned,
        "latency_seconds": round(metrics.latency_seconds, 6),
        **{f"recall@{k}": metrics.recall[k] for k in ks},
        **{f"ndcg@{k}": metrics.ndcg[k] for k in ks},
        "pairwise_accuracy": metrics.pairwise.accuracy,
        "pairwise_evaluated": metrics.pairwise.evaluated,
        "pairwise_skipped": metrics.pairwise.skipped,
        "brand_diversity": metrics.brand_diversity,
    }


class OfflineProductQueryRetriever:
    """Serve pipeline retrievals from a fixed snapshot embedding.

    Used by the offline (leave-one-out) mode: before each query the
    runner points it at the anchor product's embedding, and the anchor
    itself is excluded from results so it cannot inflate metrics.
    """

    def __init__(self, index: CatalogVectorIndex) -> None:
        self._index = index
        self._embedding: list[float] | None = None
        self._exclude_key: str | None = None

    def use_query_product(self, key: str) -> None:
        source, _, external_id = key.partition(":")
        embedding = self._index.embedding_of(source, external_id)
        if embedding is None:
            raise EvaluationError(
                f"query product {key} is not in the vector index"
            )
        self._embedding = embedding
        self._exclude_key = key

    def retrieve(
        self,
        *,
        text: str | None,
        image: bytes | None,
        mime_type: str | None,
        filters: SearchFilters,
        limit: int = 50,
    ) -> list[SearchHit]:
        del text, image, mime_type
        if self._embedding is None:
            raise EvaluationError(
                "offline retriever has no active query product"
            )
        hits = self._index.search(
            self._embedding,
            filters,
            limit=limit,
        )
        return [
            hit
            for hit in hits
            if product_key(hit.product) != self._exclude_key
        ]


def generate_seed_queries(
    index: CatalogVectorIndex,
    *,
    max_queries: int = 30,
    rng_seed: int = 42,
    min_group_size: int = 4,
    max_pairs: int = 5,
) -> list[dict[str, Any]]:
    """Derive heuristic labeled queries from the catalog snapshot.

    Relevance is metadata-derived: same-subcategory products are
    relevant (grade 1), and those sharing a detected color with the
    anchor are preferred (grade 2). Replace with human labels before
    trusting compatibility-level conclusions.
    """
    products = index.products
    tags_by_key = {
        product_key(product): infer_product_tags(product)
        for product in products
    }
    groups: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for product in products:
        subcategory = str(product["subcategory"])
        for query_gender in ("MALE", "FEMALE"):
            if product["gender"] in {query_gender, "UNISEX"}:
                groups.setdefault(
                    (query_gender, subcategory),
                    [],
                ).append(product)
    rng = random.Random(rng_seed)
    candidate_anchors: list[tuple[str, str, dict[str, Any]]] = []
    for (query_gender, subcategory), members in sorted(
        groups.items()
    ):
        if len(members) < min_group_size:
            continue
        colored = [
            member
            for member in sorted(
                members,
                key=lambda item: str(item["external_id"]),
            )
            if tags_by_key[product_key(member)].colors
        ]
        if not colored:
            continue
        anchor = colored[rng.randrange(len(colored))]
        candidate_anchors.append((query_gender, subcategory, anchor))
    rng.shuffle(candidate_anchors)
    queries: list[dict[str, Any]] = []
    for query_gender, subcategory, anchor in candidate_anchors[
        :max_queries
    ]:
        anchor_key = product_key(anchor)
        anchor_tags = tags_by_key[anchor_key]
        relevant: dict[str, int] = {}
        for member in groups[(query_gender, subcategory)]:
            member_key = product_key(member)
            if member_key == anchor_key:
                continue
            shared_colors = (
                anchor_tags.colors & tags_by_key[member_key].colors
            )
            relevant[member_key] = 2 if shared_colors else 1
        if not relevant:
            continue
        preferred = sorted(
            key for key, grade in relevant.items() if grade == 2
        )
        others = sorted(
            key for key, grade in relevant.items() if grade == 1
        )
        pairs = [
            [better, worse]
            for better, worse in zip(preferred, others)
        ][:max_pairs]
        queries.append(
            {
                "schema_version": EVAL_DATASET_SCHEMA_VERSION,
                "query_id": (
                    f"seed-{query_gender.lower()}-"
                    f"{subcategory.lower()}-{anchor['external_id']}"
                ),
                "text": _seed_query_text(subcategory, anchor_tags),
                "query_product_key": anchor_key,
                "filters": {
                    "gender": query_gender,
                    "category": anchor["category"],
                    "subcategory": None,
                    "budget_min": 0,
                    "budget_max": None,
                },
                "relevant": dict(sorted(relevant.items())),
                "pairs": pairs,
                "label_source": "heuristic",
            }
        )
    queries.sort(key=lambda query: query["query_id"])
    return queries


def _seed_query_text(subcategory: str, tags: Any) -> str:
    words: list[str] = []
    colors = sorted(tags.colors)
    if colors:
        words.append(_COLOR_LABELS.get(colors[0], colors[0]))
    seasons = sorted(tags.seasons)
    if seasons:
        words.append(_SEASON_LABELS.get(seasons[0], seasons[0]))
    words.append(
        _SUBCATEGORY_QUERY_LABELS.get(subcategory, subcategory)
    )
    return " ".join(words)


__all__ = [
    "DEFAULT_METRIC_KS",
    "EVAL_DATASET_SCHEMA_VERSION",
    "EvalQuery",
    "EvaluationError",
    "OfflineProductQueryRetriever",
    "PairwiseResult",
    "brand_diversity_at_k",
    "evaluate_queries",
    "generate_seed_queries",
    "load_eval_queries",
    "ndcg_at_k",
    "pairwise_accuracy",
    "product_key",
    "recall_at_k",
]
