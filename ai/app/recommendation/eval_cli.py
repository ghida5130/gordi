"""Command-line runner for recommendation evaluation datasets."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

from app.recommendation.catalog_embeddings import (
    CatalogEmbeddingError,
    EmbeddingSettings,
    OpenRouterEmbeddingProvider,
)
from app.recommendation.evaluation import (
    DEFAULT_METRIC_KS,
    EvalQuery,
    EvaluationError,
    OfflineProductQueryRetriever,
    evaluate_queries,
    generate_seed_queries,
    load_eval_queries,
)
from app.recommendation.pipeline import (
    COMPATIBILITY_WEIGHT,
    RETRIEVAL_WEIGHT,
    RecommendationPipeline,
    RecommendationPipelineError,
)
from app.recommendation.vector_index import (
    CandidateRetriever,
    CatalogVectorIndex,
    VectorIndexError,
)
from app.recommendation.vlm import (
    OpenAICompatibleVLMClient,
    VLMError,
    VLMSettings,
)
from app.recommendation.vlm_reranker import (
    VLMPairwiseCompatibilityModel,
)

DEFAULT_INDEX_PATH = Path("catalog_index/catalog-embeddings.json")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Evaluate the recommendation pipeline against a labeled "
            "query dataset"
        )
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    seed = subparsers.add_parser(
        "generate-seed",
        help=(
            "Derive a heuristic labeled seed dataset from the catalog "
            "snapshot (placeholder until human labels exist)"
        ),
    )
    seed.add_argument("--index", type=Path, default=DEFAULT_INDEX_PATH)
    seed.add_argument("--output", type=Path, required=True)
    seed.add_argument("--max-queries", type=int, default=30)
    seed.add_argument("--rng-seed", type=int, default=42)

    run = subparsers.add_parser(
        "run",
        help="Run the pipeline over a dataset and report metrics",
    )
    run.add_argument("--index", type=Path, default=DEFAULT_INDEX_PATH)
    run.add_argument("--dataset", type=Path, required=True)
    run.add_argument("--output", type=Path)
    run.add_argument(
        "--mode",
        choices=("offline", "live"),
        default="offline",
        help=(
            "offline reuses each query product's snapshot embedding "
            "(no API calls); live embeds query text via OpenRouter"
        ),
    )
    run.add_argument("--result-limit", type=int, default=10)
    run.add_argument("--candidate-limit", type=int, default=50)
    run.add_argument(
        "--rerank-model",
        help=(
            "Enable VLM pairwise reranking with this model "
            "(needs OPENROUTER_API_KEY or RECOMMENDATION_VLM_API_KEY); "
            "judgments are metadata-only so model comparison stays fair"
        ),
    )
    run.add_argument("--rerank-top-k", type=int, default=20)
    run.add_argument("--rerank-concurrency", type=int, default=8)
    run.add_argument(
        "--rerank-reasoning-effort",
        default="low",
        help=(
            "reasoning effort for judgment calls (minimal/low/medium/"
            "high); pass 'none' for models that reject the field"
        ),
    )
    run.add_argument(
        "--rerank-endpoint",
        default="https://openrouter.ai/api/v1/chat/completions",
    )
    return parser


class _CountingReranker:
    """Wrap a pairwise model to count judgments and failures."""

    def __init__(self, inner: VLMPairwiseCompatibilityModel) -> None:
        self._inner = inner
        self.judged = 0
        self.failed = 0

    def score_pair(self, **kwargs: Any) -> Any:
        self.judged += 1
        try:
            return self._inner.score_pair(**kwargs)
        except Exception:
            self.failed += 1
            raise


def _build_reranker(args: argparse.Namespace) -> _CountingReranker:
    api_key = (
        os.environ.get("RECOMMENDATION_VLM_API_KEY", "").strip()
        or os.environ.get("OPENROUTER_API_KEY", "").strip()
    )
    client = OpenAICompatibleVLMClient(
        VLMSettings(
            model=args.rerank_model,
            endpoint=args.rerank_endpoint,
            api_key=api_key,
        )
    )
    effort = args.rerank_reasoning_effort.strip().lower()
    return _CountingReranker(
        VLMPairwiseCompatibilityModel(
            client,
            reasoning_effort=(
                None if effort in {"", "none"} else effort
            ),
        )
    )


def _run_offline(
    index: CatalogVectorIndex,
    queries: list[EvalQuery],
    *,
    result_limit: int,
    candidate_limit: int,
    reranker: _CountingReranker | None = None,
    rerank_top_k: int = 20,
    rerank_concurrency: int = 8,
) -> dict[str, Any]:
    retriever = OfflineProductQueryRetriever(index)
    pipeline = RecommendationPipeline(
        retriever,
        pairwise_reranker=reranker,
        rerank_top_k=rerank_top_k,
        rerank_concurrency=rerank_concurrency,
        index_version=index.snapshot_sha256,
    )

    def run_query(query: EvalQuery) -> list:
        if query.query_product_key is None:
            raise EvaluationError(
                f"{query.query_id}: offline mode needs query_product_key"
            )
        retriever.use_query_product(query.query_product_key)
        return pipeline.recommend(
            text=query.text,
            image=None,
            mime_type=None,
            filters=query.filters,
            candidate_limit=candidate_limit,
            result_limit=result_limit,
        )

    return evaluate_queries(run_query, queries, ks=DEFAULT_METRIC_KS)


def _run_live(
    index: CatalogVectorIndex,
    queries: list[EvalQuery],
    *,
    result_limit: int,
    candidate_limit: int,
    reranker: _CountingReranker | None = None,
    rerank_top_k: int = 20,
    rerank_concurrency: int = 8,
) -> dict[str, Any]:
    provider = OpenRouterEmbeddingProvider(EmbeddingSettings.from_env())
    pipeline = RecommendationPipeline(
        CandidateRetriever(index, provider),
        pairwise_reranker=reranker,
        rerank_top_k=rerank_top_k,
        rerank_concurrency=rerank_concurrency,
        index_version=index.snapshot_sha256,
    )

    def run_query(query: EvalQuery) -> list:
        if query.text is None:
            raise EvaluationError(
                f"{query.query_id}: live mode needs query text"
            )
        return pipeline.recommend(
            text=query.text,
            image=None,
            mime_type=None,
            filters=query.filters,
            candidate_limit=candidate_limit,
            result_limit=result_limit,
        )

    try:
        return evaluate_queries(run_query, queries, ks=DEFAULT_METRIC_KS)
    finally:
        provider.close()


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    try:
        index = CatalogVectorIndex.load(args.index)
        if args.command == "generate-seed":
            queries = generate_seed_queries(
                index,
                max_queries=args.max_queries,
                rng_seed=args.rng_seed,
            )
            payload = "\n".join(
                json.dumps(query, ensure_ascii=False)
                for query in queries
            )
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(payload + "\n", encoding="utf-8")
            print(
                json.dumps(
                    {
                        "queries": len(queries),
                        "output": str(args.output),
                    },
                    ensure_ascii=False,
                )
            )
            return 0
        queries = load_eval_queries(args.dataset)
        reranker = (
            _build_reranker(args) if args.rerank_model else None
        )
        runner = _run_offline if args.mode == "offline" else _run_live
        report_body = runner(
            index,
            queries,
            result_limit=args.result_limit,
            candidate_limit=args.candidate_limit,
            reranker=reranker,
            rerank_top_k=args.rerank_top_k,
            rerank_concurrency=args.rerank_concurrency,
        )
    except (
        EvaluationError,
        RecommendationPipelineError,
        VectorIndexError,
        CatalogEmbeddingError,
        VLMError,
    ) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    report = {
        "generated_at": time.strftime(
            "%Y-%m-%dT%H:%M:%S%z",
            time.localtime(),
        ),
        "mode": args.mode,
        "dataset": str(args.dataset),
        "result_limit": args.result_limit,
        "candidate_limit": args.candidate_limit,
        "index": {
            "model": index.model,
            "dimensions": index.dimensions,
            "snapshot_sha256": index.snapshot_sha256,
            "product_count": index.product_count,
        },
        "scoring": {
            "retrieval_weight": RETRIEVAL_WEIGHT,
            "compatibility_weight": COMPATIBILITY_WEIGHT,
        },
        "rerank": (
            {
                "model": args.rerank_model,
                "top_k": args.rerank_top_k,
                "concurrency": args.rerank_concurrency,
                "reasoning_effort": args.rerank_reasoning_effort,
                "judged": reranker.judged,
                "failed": reranker.failed,
            }
            if reranker is not None
            else None
        ),
        **report_body,
    }
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output is not None:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
