"""Discover Musinsa product IDs via public PLP list API (slow, internal eval).

Policy notes (v1.1 / mvp-internal-eval-v1):
- List pages only (not product detail). Product collect remains separate.
- Single worker, polite delay between pages, stop on 403/429/503.
- Does not bypass blocks. Output is ID text files for garment_collector.

Example:
  python scripts/discover_plp_ids.py \\
    --dataset-root garment_dataset-v2 \\
    --out-dir batches \\
    --target-per-cell 500 \\
    --oversample 1.6
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

PLP_URL = "https://api.musinsa.com/api2/dp/v1/plp/goods"
USER_AGENT = "GordiGarmentCollector/1.0 (+internal-mvp; contact=team-internal)"
STOP_STATUSES = frozenset({403, 429, 503})
DEFAULT_PAGE_DELAY_SEC = 1.5
DEFAULT_PAGE_SIZE = 60

# (gf, category, note) sources per target cell.
# Outer (002) is collected as TOP by current backend contract.
CELL_SOURCES: dict[str, list[tuple[str, str, str]]] = {
    "MALE/TOP": [
        ("M", "001", "상의"),
        ("M", "001001", "반소매 티셔츠"),
        ("M", "001002", "셔츠"),
        ("M", "001004", "후드"),
        ("M", "001005", "스웨트"),
        ("M", "001006", "니트"),
        ("M", "002", "아우터→TOP"),
        ("M", "002001", "블루종 등"),
    ],
    "MALE/BOTTOM": [
        ("M", "003", "바지"),
        ("M", "003002", "데님"),
        ("M", "003004", "코튼 등"),
        ("M", "003006", "워크팬츠"),
        ("M", "003007", "슬랙스/밴딩"),
        ("M", "003008", "슬랙스"),
        ("M", "003005", "쇼츠"),
    ],
    "FEMALE/TOP": [
        ("F", "001", "상의"),
        ("F", "001001", "반소매 티셔츠"),
        ("F", "001002", "셔츠"),
        ("F", "001004", "후드"),
        ("F", "001005", "스웨트"),
        ("F", "001006", "니트"),
        ("F", "002", "아우터→TOP"),
        ("F", "002003", "블레이저 등"),
    ],
    "FEMALE/BOTTOM": [
        ("F", "003", "바지"),
        ("F", "003002", "데님"),
        ("F", "003004", "코튼 등"),
        ("F", "003006", "워크팬츠"),
        ("F", "003007", "슬랙스/밴딩"),
        ("F", "003008", "슬랙스"),
        ("F", "003005", "쇼츠"),
        ("F", "100", "스커트"),
    ],
}

SORT_CODES = ("POPULAR", "NEW", "REVIEW")

CELL_FILE = {
    "MALE/TOP": "male_top.txt",
    "MALE/BOTTOM": "male_bottom.txt",
    "FEMALE/TOP": "female_top.txt",
    "FEMALE/BOTTOM": "female_bottom.txt",
}


@dataclass
class DiscoverReport:
    started_at: str
    finished_at: str | None = None
    target_per_cell: int = 500
    oversample: float = 1.6
    page_delay_sec: float = DEFAULT_PAGE_DELAY_SEC
    existing_ids: int = 0
    stopped: bool = False
    stop_reason: str | None = None
    cells: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "target_per_cell": self.target_per_cell,
            "oversample": self.oversample,
            "page_delay_sec": self.page_delay_sec,
            "existing_ids": self.existing_ids,
            "stopped": self.stopped,
            "stop_reason": self.stop_reason,
            "cells": self.cells,
        }


def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat()


def load_existing_ids(dataset_root: Path) -> set[str]:
    ids: set[str] = set()
    normalized = dataset_root / "normalized"
    if normalized.is_dir():
        for path in normalized.rglob("*.json"):
            ids.add(path.stem)
    # also accept pilot lists as "already known" optional — keep only normalized
    return ids


def fetch_page(
    client: httpx.Client,
    *,
    gf: str,
    category: str,
    page: int,
    size: int,
    sort_code: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    response = client.get(
        PLP_URL,
        params={
            "gf": gf,
            "category": category,
            "caller": "CATEGORY",
            "device": "mw",
            "sortCode": sort_code,
            "page": page,
            "size": size,
        },
    )
    if response.status_code in STOP_STATUSES:
        raise RuntimeError(
            f"stop status {response.status_code} on PLP "
            f"gf={gf} category={category} page={page}"
        )
    response.raise_for_status()
    payload = response.json()
    data = payload.get("data") or {}
    items = data.get("list") or []
    pagination = data.get("pagination") or {}
    if not isinstance(items, list):
        items = []
    return items, pagination if isinstance(pagination, dict) else {}


def discover_cell(
    client: httpx.Client,
    *,
    cell: str,
    sources: list[tuple[str, str, str]],
    existing: set[str],
    need: int,
    page_size: int,
    page_delay_sec: float,
    max_pages_per_source: int,
) -> dict[str, Any]:
    """Collect *need* new IDs for one cell; return cell report + ordered ids."""
    collected: list[str] = []
    seen: set[str] = set()
    source_stats: list[dict[str, Any]] = []

    for gf, category, note in sources:
        if len(collected) >= need:
            break
        for sort_code in SORT_CODES:
            if len(collected) >= need:
                break
            pages_fetched = 0
            new_from_source = 0
            for page in range(1, max_pages_per_source + 1):
                if len(collected) >= need:
                    break
                items, pagination = fetch_page(
                    client,
                    gf=gf,
                    category=category,
                    page=page,
                    size=page_size,
                    sort_code=sort_code,
                )
                pages_fetched += 1
                if not items:
                    break
                for item in items:
                    goods_no = item.get("goodsNo")
                    if goods_no is None:
                        continue
                    pid = str(goods_no)
                    if pid in existing or pid in seen:
                        continue
                    seen.add(pid)
                    collected.append(pid)
                    new_from_source += 1
                    if len(collected) >= need:
                        break
                has_next = bool(pagination.get("hasNext"))
                time.sleep(page_delay_sec)
                if not has_next:
                    break
            source_stats.append(
                {
                    "gf": gf,
                    "category": category,
                    "note": note,
                    "sort_code": sort_code,
                    "pages_fetched": pages_fetched,
                    "new_ids": new_from_source,
                }
            )
            if new_from_source == 0 and pages_fetched <= 1:
                # empty source+sort — continue others
                continue

    return {
        "cell": cell,
        "requested_new": need,
        "discovered_new": len(collected),
        "ids": collected,
        "sources": source_stats,
    }


def write_ids_file(path: Path, cell: str, ids: list[str], header_extra: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        f"# {cell} — discovered {_now_iso()}",
        f"# {header_extra}",
        f"# count={len(ids)}",
    ]
    lines.extend(ids)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dataset-root",
        type=Path,
        default=Path("garment_dataset-v2"),
        help="Existing dataset root (normalized IDs are skipped)",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path("batches"),
        help="Output directory for cell id files",
    )
    parser.add_argument(
        "--target-per-cell",
        type=int,
        default=500,
        help="Target inventory per cell after collection",
    )
    parser.add_argument(
        "--oversample",
        type=float,
        default=1.6,
        help="Discover this many × gap (failures/exclusions buffer)",
    )
    parser.add_argument(
        "--page-delay",
        type=float,
        default=DEFAULT_PAGE_DELAY_SEC,
        help=f"Seconds between PLP pages (default {DEFAULT_PAGE_DELAY_SEC})",
    )
    parser.add_argument(
        "--page-size",
        type=int,
        default=DEFAULT_PAGE_SIZE,
        help="PLP page size (max ~60)",
    )
    parser.add_argument(
        "--max-pages-per-source",
        type=int,
        default=8,
        help="Cap pages per (gf, category, sort) to diversify sources",
    )
    parser.add_argument(
        "--include-existing-in-batch",
        action="store_true",
        help="Also append already-normalized IDs into batch files (collect will skip)",
    )
    args = parser.parse_args(argv)

    if args.page_delay < 1.0:
        print("error: --page-delay must be >= 1.0", file=sys.stderr)
        return 2
    if args.oversample < 1.0:
        print("error: --oversample must be >= 1.0", file=sys.stderr)
        return 2

    dataset_root = args.dataset_root.resolve()
    out_dir = args.out_dir.resolve()
    existing = load_existing_ids(dataset_root)

    # Current per-cell counts from normalized JSON (best-effort).
    current_cells: dict[str, int] = {k: 0 for k in CELL_SOURCES}
    for path in (dataset_root / "normalized").rglob("*.json") if (
        dataset_root / "normalized"
    ).is_dir() else []:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        product = data.get("product") or {}
        gender = str(product.get("gender") or "").upper()
        backend = str(product.get("backend_category") or "").upper()
        key = f"{gender}/{backend}"
        if key in current_cells:
            current_cells[key] += 1

    report = DiscoverReport(
        started_at=_now_iso(),
        target_per_cell=args.target_per_cell,
        oversample=args.oversample,
        page_delay_sec=args.page_delay,
        existing_ids=len(existing),
    )

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    }

    all_new: list[str] = []
    all_for_overnight: list[str] = []
    seen_global: set[str] = set()

    try:
        with httpx.Client(headers=headers, timeout=30.0, follow_redirects=True) as client:
            for cell, sources in CELL_SOURCES.items():
                have = current_cells.get(cell, 0)
                gap = max(0, args.target_per_cell - have)
                need = int(gap * args.oversample + 0.999) if gap else 0
                # Always discover at least a small top-up if gap is 0 but user wants full re-list
                print(
                    f"[{cell}] have={have} target={args.target_per_cell} "
                    f"gap={gap} discover_need={need}",
                    flush=True,
                )
                if need == 0:
                    report.cells[cell] = {
                        "have": have,
                        "gap": 0,
                        "requested_new": 0,
                        "discovered_new": 0,
                        "ids": [],
                        "sources": [],
                    }
                    continue

                cell_result = discover_cell(
                    client,
                    cell=cell,
                    sources=sources,
                    existing=existing | seen_global,
                    need=need,
                    page_size=args.page_size,
                    page_delay_sec=args.page_delay,
                    max_pages_per_source=args.max_pages_per_source,
                )
                cell_result["have"] = have
                cell_result["gap"] = gap
                report.cells[cell] = {
                    k: v for k, v in cell_result.items() if k != "ids"
                }
                report.cells[cell]["id_count"] = len(cell_result["ids"])

                ids = cell_result["ids"]
                for pid in ids:
                    seen_global.add(pid)
                    all_new.append(pid)

                file_name = CELL_FILE[cell]
                out_path = out_dir / file_name
                batch_ids = list(ids)
                if args.include_existing_in_batch:
                    # optional: not used by default
                    pass
                write_ids_file(
                    out_path,
                    cell,
                    batch_ids,
                    f"gap={gap} oversample={args.oversample} have={have}",
                )
                print(
                    f"  wrote {out_path.name}: {len(batch_ids)} new ids",
                    flush=True,
                )
                all_for_overnight.extend(batch_ids)

    except RuntimeError as exc:
        report.stopped = True
        report.stop_reason = str(exc)
        print(f"STOPPED: {exc}", file=sys.stderr)
        report.finished_at = _now_iso()
        (out_dir / "discover-report.json").write_text(
            json.dumps(report.to_dict(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return 3
    except httpx.HTTPError as exc:
        report.stopped = True
        report.stop_reason = f"http error: {exc}"
        print(f"STOPPED http: {exc}", file=sys.stderr)
        report.finished_at = _now_iso()
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "discover-report.json").write_text(
            json.dumps(report.to_dict(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return 3

    # overnight combined (new IDs only; collect --skip-existing handles rest)
    overnight = out_dir / "overnight_all.txt"
    write_ids_file(
        overnight,
        "ALL",
        all_for_overnight,
        f"combined new ids for overnight collect; unique={len(all_for_overnight)}",
    )

    report.finished_at = _now_iso()
    report_path = out_dir / "discover-report.json"
    # attach full id lists in a sidecar (can be large)
    full = report.to_dict()
    full["overnight_new_count"] = len(all_for_overnight)
    full["current_cells"] = current_cells
    report_path.write_text(
        json.dumps(full, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(
        f"done: overnight_all={len(all_for_overnight)} report={report_path}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
