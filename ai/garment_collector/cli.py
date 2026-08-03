"""CLI entrypoints for garment collection and validation."""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

from garment_collector.adapters.musinsa import MusinsaAdapter
from garment_collector.config import CollectorSettings
from garment_collector.models import GarmentRecord
from garment_collector.mysql_seeder import (
    MySQLSettings,
    SeedError,
    connect_database,
    load_uploaded_manifest,
    seed_database,
)
from garment_collector.pipeline import CollectionPipeline
from garment_collector.reprocess import ReprocessError, reprocess_dataset
from garment_collector.seed_manifest import (
    ManifestError,
    export_seed_manifest,
)
from garment_collector.s3_uploader import (
    S3Settings,
    S3UploadError,
    create_s3_client,
    upload_manifest,
)
from garment_collector.storage import DatasetStorage
from garment_collector.validate import validate_record


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="garment_collector",
        description=(
            "GORDI garment dataset collector "
            "(MVP internal evaluation / public-html-slow-fetch)"
        ),
    )

    sub = parser.add_subparsers(dest="command", required=True)

    collect = sub.add_parser("collect", help="Collect products from Musinsa")
    collect.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="debug logging",
    )
    collect.add_argument(
        "--ids",
        nargs="+",
        help="Product IDs (space-separated)",
    )
    collect.add_argument(
        "--ids-file",
        type=Path,
        help="Text file with one product ID per line",
    )
    collect.add_argument(
        "--dataset-root",
        type=Path,
        default=Path("garment_dataset"),
        help="Output dataset root (default: ./garment_dataset)",
    )
    collect.add_argument(
        "--max-items",
        type=int,
        default=None,
        help=(
            "Optional safety cap on this run (default: no cap). "
            "Expansion target is 500 per gender×slot cell."
        ),
    )
    collect.add_argument(
        "--product-delay",
        type=float,
        default=None,
        help=(
            "Seconds between products / first paced product request "
            "(min 3.0; same-product secondary APIs are unpaced)"
        ),
    )
    collect.add_argument(
        "--image-delay",
        type=float,
        default=None,
        help="Seconds between image requests (min 1.0)",
    )
    collect.add_argument(
        "--dry-run",
        action="store_true",
        help="Resolve IDs and exit without network writes",
    )
    collect.add_argument(
        "--skip-existing",
        action="store_true",
        help=(
            "Skip IDs whose normalized JSON already exists in "
            "--dataset-root (safe batch resume without re-fetching)"
        ),
    )

    validate = sub.add_parser(
        "validate", help="Re-validate normalized JSON files"
    )
    validate.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="debug logging",
    )
    validate.add_argument(
        "--dataset-root",
        type=Path,
        default=Path("garment_dataset"),
    )
    validate.add_argument(
        "--path",
        type=Path,
        help="Single normalized JSON path (optional)",
    )
    validate.add_argument(
        "--write",
        action="store_true",
        help="Write validation status back into JSON files",
    )

    reprocess = sub.add_parser(
        "reprocess",
        help="Offline reparse an existing raw bundle as primary-only v2",
    )
    reprocess.add_argument(
        "--source-root",
        type=Path,
        required=True,
        help="Existing v1 dataset root",
    )
    reprocess.add_argument(
        "--output-root",
        type=Path,
        required=True,
        help="Empty output root for garment-dataset-v2",
    )

    export_seed = sub.add_parser(
        "export-seed",
        help=(
            "Export the strict backend seed manifest "
            "(defaults to the original 198-product split)"
        ),
    )
    export_seed.add_argument(
        "--dataset-root",
        type=Path,
        required=True,
        help="Reviewed garment-dataset-v2 root",
    )
    export_seed.add_argument(
        "--selection-file",
        type=Path,
        required=True,
        help="Balanced selection report containing grouped ids",
    )
    export_seed.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Output manifest path (kept outside Git)",
    )
    export_seed.add_argument(
        "--expected-counts-file",
        type=Path,
        help=(
            "JSON file overriding expected group counts, e.g. "
            '{"MALE/TOP": 100, "FEMALE/BOTTOM": 100}; '
            "defaults to the original 198-product split"
        ),
    )
    export_seed.add_argument(
        "--expected-size-rows",
        type=int,
        help=(
            "Expected total size-row count for the expanded selection; "
            "required together with --expected-counts-file"
        ),
    )

    upload_s3 = sub.add_parser(
        "upload-s3",
        help="Idempotently upload manifest primary images to private S3",
    )
    upload_s3.add_argument(
        "--manifest",
        type=Path,
        required=True,
        help="gordi-product-seed-v1 manifest",
    )
    upload_s3.add_argument(
        "--dataset-root",
        type=Path,
        required=True,
        help="Dataset root containing manifest primary.local_path files",
    )
    upload_s3.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Manifest path to write with image_url/object key",
    )
    upload_s3.add_argument(
        "--dry-run",
        action="store_true",
        help="Run HeadObject preflight only; do not upload or write output",
    )

    seed_db = sub.add_parser(
        "seed-db",
        help="Validate and transactionally seed the backend MySQL catalog",
    )
    seed_db.add_argument(
        "--manifest",
        type=Path,
        required=True,
        help="S3-enriched gordi-product-seed-v1 manifest",
    )
    mode = seed_db.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate schema/manifest and inspect targets without DML",
    )
    mode.add_argument(
        "--apply",
        action="store_true",
        help="Back up targets and apply one transaction",
    )
    seed_db.add_argument(
        "--backup-output",
        type=Path,
        help="Required with --apply; JSON backup of targeted existing rows",
    )
    seed_db.add_argument(
        "--expected-products",
        type=int,
        help=(
            "Expected product count for the expanded manifest; "
            "required together with --expected-size-rows "
            "(defaults to the original 198-product split)"
        ),
    )
    seed_db.add_argument(
        "--expected-size-rows",
        type=int,
        help="Expected total size-row count for the expanded manifest",
    )

    review_images = sub.add_parser(
        "review-images",
        help=(
            "Fill primary-image review fields with a small VLM and "
            "promote clean records to READY"
        ),
    )
    review_images.add_argument(
        "--dataset-root",
        type=Path,
        required=True,
    )
    review_images.add_argument(
        "--model",
        default=os.environ.get(
            "RECOMMENDATION_VLM_MODEL",
            "openai/gpt-5.6-luna",
        ),
    )
    review_images.add_argument(
        "--endpoint",
        default="https://openrouter.ai/api/v1/chat/completions",
    )
    review_images.add_argument(
        "--reviewer",
        default=None,
        help="Recorded reviewer id (default: vlm:<model>)",
    )
    review_images.add_argument("--limit", type=int, default=None)
    review_images.add_argument("--concurrency", type=int, default=8)
    review_images.add_argument(
        "--reasoning-effort",
        default="low",
        help=(
            "reasoning effort for review calls (minimal/low/medium/"
            "high); pass 'none' for models that reject the field"
        ),
    )
    review_images.add_argument(
        "--dry-run",
        action="store_true",
        help="Count target records without VLM calls or writes",
    )

    return parser


def _load_ids(args: argparse.Namespace) -> list[str]:
    ids: list[str] = []
    if args.ids:
        ids.extend(args.ids)
    if args.ids_file:
        text = args.ids_file.read_text(encoding="utf-8")
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            # allow "12345  # group" trailing comments
            if "#" in line:
                line = line.split("#", 1)[0].strip()
            if line:
                ids.append(line)
    # de-dupe preserve order
    seen: set[str] = set()
    ordered: list[str] = []
    for item in ids:
        if item not in seen:
            seen.add(item)
            ordered.append(item)
    return ordered


def cmd_collect(args: argparse.Namespace) -> int:
    ids = _load_ids(args)
    if not ids:
        print("error: provide --ids and/or --ids-file", file=sys.stderr)
        return 2
    if args.max_items is not None and len(ids) > args.max_items:
        print(
            f"error: {len(ids)} ids exceeds --max-items {args.max_items}",
            file=sys.stderr,
        )
        return 2

    kwargs: dict = {
        "dataset_root": args.dataset_root.resolve(),
        "dry_run": args.dry_run,
        "skip_existing": args.skip_existing,
    }
    if args.max_items is not None:
        kwargs["max_items"] = args.max_items
    if args.product_delay is not None:
        kwargs["product_delay_sec"] = args.product_delay
    if args.image_delay is not None:
        kwargs["image_delay_sec"] = args.image_delay

    try:
        settings = CollectorSettings(**kwargs)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    pipeline = CollectionPipeline(settings, MusinsaAdapter())
    report = pipeline.run(ids)
    print(json.dumps(report.to_dict(), ensure_ascii=False, indent=2))
    if report.stopped:
        return 3
    if report.failed and not report.succeeded:
        return 1
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    root = args.dataset_root.resolve()
    storage = DatasetStorage(root)
    paths: list[Path]
    if args.path:
        paths = [args.path]
    else:
        paths = sorted((root / "normalized").rglob("*.json"))

    summary = {
        "checked": 0,
        "validated": 0,
        "review_required": 0,
        "invalid": 0,
        "items": [],
    }

    for path in paths:
        data = json.loads(path.read_text(encoding="utf-8"))
        record = GarmentRecord.model_validate(data)
        record = validate_record(record, dataset_root=root)
        summary["checked"] += 1
        status = record.validation.status.value
        if status == "VALIDATED":
            summary["validated"] += 1
        elif status == "REVIEW_REQUIRED":
            summary["review_required"] += 1
        elif status == "INVALID":
            summary["invalid"] += 1
        summary["items"].append(
            {
                "path": str(path),
                "status": status,
                "warnings": record.validation.warnings,
            }
        )
        if args.write:
            path.write_text(record.model_dump_json(indent=2), encoding="utf-8")

    storage.write_report("validation-summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if summary["invalid"] == 0 else 1


def cmd_reprocess(args: argparse.Namespace) -> int:
    try:
        summary = reprocess_dataset(
            args.source_root,
            args.output_root,
        )
    except ReprocessError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


def _load_expected_counts(path: Path) -> dict[str, int]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not payload:
        raise ManifestError(
            "expected-counts file must be a non-empty JSON object"
        )
    counts: dict[str, int] = {}
    for group, count in payload.items():
        if (
            not isinstance(group, str)
            or isinstance(count, bool)
            or not isinstance(count, int)
            or count < 1
        ):
            raise ManifestError(
                "expected-counts entries must map group names to "
                "positive integers"
            )
        counts[group] = count
    return counts


def cmd_export_seed(args: argparse.Namespace) -> int:
    try:
        if (args.expected_counts_file is None) != (
            args.expected_size_rows is None
        ):
            raise ManifestError(
                "--expected-counts-file and --expected-size-rows "
                "must be provided together"
            )
        expected_group_counts = None
        if args.expected_counts_file is not None:
            expected_group_counts = _load_expected_counts(
                args.expected_counts_file
            )
        manifest = export_seed_manifest(
            args.dataset_root,
            args.selection_file,
            args.output,
            expected_group_counts=expected_group_counts,
            expected_size_rows=args.expected_size_rows,
        )
    except (ManifestError, OSError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(
        json.dumps(
            {
                "schema_version": manifest["schema_version"],
                "product_count": manifest["product_count"],
                "size_row_count": manifest["size_row_count"],
                "group_counts": manifest["group_counts"],
                "manifest_sha256": manifest["manifest_sha256"],
                "output": str(args.output.resolve()),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


def cmd_upload_s3(args: argparse.Namespace) -> int:
    try:
        settings = S3Settings.from_env()
        report = upload_manifest(
            args.manifest,
            args.dataset_root,
            args.output,
            client=create_s3_client(settings),
            bucket=settings.bucket,
            image_base_url=settings.image_base_url,
            dry_run=args.dry_run,
        )
    except S3UploadError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(
        json.dumps(
            {
                "checked": report.checked,
                "uploaded": report.uploaded,
                "skipped": report.skipped,
                "dry_run": report.dry_run,
                "output": (
                    None if report.dry_run else str(args.output.resolve())
                ),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


def cmd_seed_db(args: argparse.Namespace) -> int:
    connection = None
    try:
        settings = MySQLSettings.from_env()
        image_base_url = os.environ.get("GARMENT_IMAGE_BASE_URL")
        if not image_base_url:
            raise SeedError(
                "missing required environment variable: "
                "GARMENT_IMAGE_BASE_URL"
            )
        if args.apply and args.backup_output is None:
            raise SeedError("--backup-output is required with --apply")
        if (args.expected_products is None) != (
            args.expected_size_rows is None
        ):
            raise SeedError(
                "--expected-products and --expected-size-rows must be "
                "provided together"
            )
        manifest_kwargs = {}
        if args.expected_products is not None:
            manifest_kwargs = {
                "expected_product_count": args.expected_products,
                "expected_size_row_count": args.expected_size_rows,
            }
        manifest = load_uploaded_manifest(
            args.manifest,
            image_base_url=image_base_url,
            **manifest_kwargs,
        )
        connection = connect_database(settings)
        report = seed_database(
            connection,
            manifest,
            database=settings.database,
            apply=args.apply,
            backup_output=args.backup_output,
        )
    except SeedError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    finally:
        if connection is not None:
            connection.close()
    print(
        json.dumps(
            {
                "product_count": report.product_count,
                "size_row_count": report.size_row_count,
                "existing_product_count": report.existing_product_count,
                "applied": report.applied,
                "backup_output": report.backup_output,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


def cmd_review_images(args: argparse.Namespace) -> int:
    from garment_collector.image_review import (
        ImageReviewError,
        review_dataset_images,
    )

    try:
        if args.dry_run:
            client = None
        else:
            # Reuse the shared OpenAI-compatible client; imported lazily
            # so the collector stays usable without the app package.
            from app.recommendation.vlm import (
                OpenAICompatibleVLMClient,
                VLMSettings,
            )

            api_key = (
                os.environ.get("RECOMMENDATION_VLM_API_KEY", "").strip()
                or os.environ.get("OPENROUTER_API_KEY", "").strip()
            )
            if "openrouter.ai" in args.endpoint and not api_key:
                raise ImageReviewError(
                    "OPENROUTER_API_KEY (or RECOMMENDATION_VLM_API_KEY) "
                    "is required"
                )
            client = OpenAICompatibleVLMClient(
                VLMSettings(
                    model=args.model,
                    endpoint=args.endpoint,
                    api_key=api_key,
                )
            )
        effort = args.reasoning_effort.strip().lower()
        report = review_dataset_images(
            args.dataset_root,
            client,
            reviewer=args.reviewer or f"vlm:{args.model}",
            limit=args.limit,
            concurrency=args.concurrency,
            dry_run=args.dry_run,
            reasoning_effort=(
                None if effort in {"", "none"} else effort
            ),
        )
    except ImageReviewError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    payload = report.to_dict()
    payload["errors"] = payload["errors"][:20]
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if report.failed == 0 else 1


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if getattr(args, "verbose", False) else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    if args.command == "collect":
        return cmd_collect(args)
    if args.command == "validate":
        return cmd_validate(args)
    if args.command == "reprocess":
        return cmd_reprocess(args)
    if args.command == "export-seed":
        return cmd_export_seed(args)
    if args.command == "upload-s3":
        return cmd_upload_s3(args)
    if args.command == "seed-db":
        return cmd_seed_db(args)
    if args.command == "review-images":
        return cmd_review_images(args)
    parser.error(f"unknown command {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
