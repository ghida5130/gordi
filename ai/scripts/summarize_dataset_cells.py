"""Summarize gender×backend_category cell counts in a normalized dataset."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

# Cell targets from policy v1.1 / config
TARGET_PER_CELL = 500
TARGET_CELLS = (
    "MALE/TOP",
    "MALE/BOTTOM",
    "FEMALE/TOP",
    "FEMALE/BOTTOM",
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dataset-root",
        type=Path,
        default=Path("garment_dataset-v2"),
        help="Dataset root containing normalized/",
    )
    args = parser.parse_args(argv)

    root = args.dataset_root.resolve()
    paths = sorted((root / "normalized").rglob("*.json"))
    if not paths:
        print(f"no normalized JSON under {root / 'normalized'}", file=sys.stderr)
        return 1

    cells: Counter[str] = Counter()
    slots: Counter[str] = Counter()
    status: Counter[str] = Counter()
    bad = 0

    for path in paths:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            bad += 1
            continue
        product = data.get("product") or {}
        gender = str(product.get("gender") or "UNKNOWN").upper()
        backend_cat = str(product.get("backend_category") or "UNKNOWN").upper()
        cells[f"{gender}/{backend_cat}"] += 1
        slots[str(product.get("slot") or "UNKNOWN")] += 1
        validation = data.get("validation") or {}
        status[str(validation.get("status") or "UNKNOWN")] += 1

    print(f"dataset_root: {root}")
    print(f"normalized_files: {len(paths)}  parse_errors: {bad}")
    print()
    print("cell counts (gender/backend_category) vs target 500:")
    for key in TARGET_CELLS:
        n = cells.get(key, 0)
        gap = TARGET_PER_CELL - n
        flag = "OK" if n >= TARGET_PER_CELL else f"need +{gap}"
        print(f"  {key:16} {n:5}  {flag}")
    other = {k: v for k, v in cells.items() if k not in TARGET_CELLS}
    if other:
        print("  other cells:")
        for k, v in sorted(other.items()):
            print(f"    {k:16} {v:5}")
    print()
    print("slot:", dict(slots))
    print("validation.status:", dict(status))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
