"""CLI entrypoints for garment collection and validation."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from garment_collector.adapters.musinsa import MusinsaAdapter
from garment_collector.config import MAX_ITEMS_PILOT, CollectorSettings
from garment_collector.models import GarmentRecord
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
        default=MAX_ITEMS_PILOT,
        help=f"Max products this run (cap {MAX_ITEMS_PILOT})",
    )
    collect.add_argument(
        "--product-delay",
        type=float,
        default=None,
        help="Seconds between product requests (min 3.0)",
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
        help="Export the strict 198-product backend seed manifest",
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
    if len(ids) > args.max_items:
        print(
            f"error: {len(ids)} ids exceeds --max-items {args.max_items}",
            file=sys.stderr,
        )
        return 2

    kwargs = {
        "dataset_root": args.dataset_root.resolve(),
        "max_items": args.max_items,
        "dry_run": args.dry_run,
    }
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


def cmd_export_seed(args: argparse.Namespace) -> int:
    try:
        manifest = export_seed_manifest(
            args.dataset_root,
            args.selection_file,
            args.output,
        )
    except ManifestError as exc:
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
    parser.error(f"unknown command {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
