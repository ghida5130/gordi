"""Command-line builder for the MySQL-backed catalog embedding snapshot."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from app.recommendation.catalog import (
    CatalogDatabaseSettings,
    CatalogError,
    MySQLCatalogRepository,
    connect_catalog_database,
)
from app.recommendation.catalog_embeddings import (
    CatalogEmbeddingError,
    EmbeddingSettings,
    HttpProductImageResolver,
    OpenRouterEmbeddingProvider,
    build_catalog_embeddings,
    load_tpo_sidecar,
)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Embed AVAILABLE MySQL garments with their primary image using "
            "Gemini Embedding 2 through OpenRouter"
        )
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("catalog_index/catalog-embeddings.json"),
        help="Generated embedding snapshot (excluded from Git)",
    )
    parser.add_argument(
        "--dataset-root",
        type=Path,
        help=(
            "Resolve primary images from a local garment dataset instead of "
            "the DB image_url; useful for local pre-S3 validation"
        ),
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Embed only the first N products for a pilot run",
    )
    parser.add_argument(
        "--tpo-tags",
        type=Path,
        help=(
            "tag-tpo sidecar JSONL; adds the Korean TPO rendering to "
            "each embedding document (changes input hashes — tagged "
            "products are re-embedded) and stores tags in snapshot "
            "product metadata"
        ),
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    connection = None
    try:
        tpo_sidecar = None
        if args.tpo_tags is not None:
            tpo_sidecar = load_tpo_sidecar(args.tpo_tags)
            print(
                f"TPO sidecar: {len(tpo_sidecar)} tagged products",
                file=sys.stderr,
            )
        database_settings = CatalogDatabaseSettings.from_env()
        embedding_settings = EmbeddingSettings.from_env()
        connection = connect_catalog_database(database_settings)
        repository = MySQLCatalogRepository(connection)
        with (
            OpenRouterEmbeddingProvider(embedding_settings) as provider,
            HttpProductImageResolver(
                dataset_root=args.dataset_root
            ) as image_resolver,
        ):
            report = build_catalog_embeddings(
                repository,
                image_resolver,
                provider,
                args.output,
                limit=args.limit,
                tpo_sidecar=tpo_sidecar,
            )
    except (CatalogError, CatalogEmbeddingError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    finally:
        if connection is not None:
            connection.close()
    print(json.dumps(report.__dict__, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
