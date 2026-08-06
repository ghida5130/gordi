"""Human-labeled TPO fit evaluation: query set, judgments, aggregation.

The TPO query set has no heuristic relevance labels on purpose — TPO
fit ("would this garment work for that occasion?") is exactly what the
heuristic labeler cannot judge, so the team's human judgments collected
through the demo are the label source. Records are append-only JSONL;
re-judging the same (evaluator, query, product) later supersedes the
earlier record at aggregation time instead of mutating the file.
"""

from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from pathlib import Path
from statistics import mean
from typing import Any

TPO_QUERY_SCHEMA_VERSION = "recommendation-tpo-eval-v1"
TPO_JUDGMENT_SCHEMA_VERSION = "recommendation-tpo-judgment-v1"
FIT_VALUES = ("FIT", "UNFIT", "UNSURE")
MAX_EVALUATOR_LENGTH = 40

_APPEND_LOCK = threading.Lock()


class TpoEvalError(ValueError):
    """Invalid TPO evaluation data."""


@dataclass(frozen=True)
class TpoQuery:
    query_id: str
    text: str
    moods: tuple[str, ...]
    filters: dict[str, Any]
    label_source: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "query_id": self.query_id,
            "text": self.text,
            "moods": list(self.moods),
            "filters": dict(self.filters),
            "label_source": self.label_source,
        }


@dataclass(frozen=True)
class TpoJudgment:
    evaluator: str
    query_id: str
    product_id: int
    rank: int
    fit: str
    index_version: str
    judged_at: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "schema_version": TPO_JUDGMENT_SCHEMA_VERSION,
            "evaluator": self.evaluator,
            "query_id": self.query_id,
            "product_id": self.product_id,
            "rank": self.rank,
            "fit": self.fit,
            "index_version": self.index_version,
            "judged_at": self.judged_at,
        }


def normalize_evaluator(raw: str) -> str:
    evaluator = raw.strip()
    if not evaluator or len(evaluator) > MAX_EVALUATOR_LENGTH:
        raise TpoEvalError(
            "evaluator must be 1~"
            f"{MAX_EVALUATOR_LENGTH} characters"
        )
    return evaluator


def load_tpo_queries(path: Path) -> list[TpoQuery]:
    queries: list[TpoQuery] = []
    seen: set[str] = set()
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        raise TpoEvalError(
            f"TPO query set unavailable: {exc}"
        ) from exc
    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError as exc:
            raise TpoEvalError(
                f"invalid JSON on line {line_number}"
            ) from exc
        if payload.get("schema_version") != TPO_QUERY_SCHEMA_VERSION:
            raise TpoEvalError(
                f"unsupported query schema on line {line_number}"
            )
        query_id = payload.get("query_id")
        text = payload.get("text")
        filters = payload.get("filters")
        if not isinstance(query_id, str) or not query_id:
            raise TpoEvalError(
                f"missing query_id on line {line_number}"
            )
        if query_id in seen:
            raise TpoEvalError(f"duplicate query_id {query_id!r}")
        if not isinstance(text, str) or not text.strip():
            raise TpoEvalError(f"missing text on line {line_number}")
        if not isinstance(filters, dict):
            raise TpoEvalError(
                f"missing filters on line {line_number}"
            )
        moods = payload.get("moods") or []
        if not isinstance(moods, list) or any(
            not isinstance(mood, str) for mood in moods
        ):
            raise TpoEvalError(
                f"invalid moods on line {line_number}"
            )
        seen.add(query_id)
        queries.append(
            TpoQuery(
                query_id=query_id,
                text=text,
                moods=tuple(moods),
                filters=filters,
                label_source=str(
                    payload.get("label_source", "human")
                ),
            )
        )
    if not queries:
        raise TpoEvalError("TPO query set is empty")
    return queries


def judgment_from_payload(payload: dict[str, Any]) -> TpoJudgment:
    fit = payload.get("fit")
    if fit not in FIT_VALUES:
        raise TpoEvalError(
            f"fit must be one of {', '.join(FIT_VALUES)}"
        )
    product_id = payload.get("product_id")
    if isinstance(product_id, bool) or not isinstance(product_id, int):
        raise TpoEvalError("product_id must be an integer")
    rank = payload.get("rank")
    if isinstance(rank, bool) or not isinstance(rank, int) or rank < 1:
        raise TpoEvalError("rank must be a positive integer")
    return TpoJudgment(
        evaluator=normalize_evaluator(str(payload.get("evaluator", ""))),
        query_id=str(payload.get("query_id", "")),
        product_id=product_id,
        rank=rank,
        fit=str(fit),
        index_version=str(payload.get("index_version", "")),
        judged_at=str(payload.get("judged_at", "")),
    )


def append_judgments(path: Path, judgments: list[TpoJudgment]) -> int:
    if not judgments:
        return 0
    lines = "".join(
        json.dumps(judgment.as_dict(), ensure_ascii=False) + "\n"
        for judgment in judgments
    )
    with _APPEND_LOCK:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as handle:
            handle.write(lines)
    return len(judgments)


def load_judgments(path: Path) -> list[TpoJudgment]:
    if not path.exists():
        return []
    judgments: list[TpoJudgment] = []
    for line_number, line in enumerate(
        path.read_text(encoding="utf-8").splitlines(),
        start=1,
    ):
        if not line.strip():
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError as exc:
            raise TpoEvalError(
                f"invalid judgment JSON on line {line_number}"
            ) from exc
        if (
            payload.get("schema_version")
            != TPO_JUDGMENT_SCHEMA_VERSION
        ):
            raise TpoEvalError(
                f"unsupported judgment schema on line {line_number}"
            )
        judgments.append(judgment_from_payload(payload))
    return judgments


def _deduplicate(
    judgments: list[TpoJudgment],
) -> list[TpoJudgment]:
    latest: dict[tuple[str, str, int], TpoJudgment] = {}
    for judgment in judgments:
        key = (judgment.evaluator, judgment.query_id, judgment.product_id)
        latest[key] = judgment
    return list(latest.values())


def summarize_judgments(
    judgments: list[TpoJudgment],
    queries: list[TpoQuery],
) -> dict[str, Any]:
    """Aggregate human TPO judgments into fit-rate metrics.

    fit_rate = FIT / (FIT + UNFIT); UNSURE is excluded from the
    denominator so hesitation does not count against the pipeline.
    The macro rate averages per-(query, evaluator) runs so one
    heavily-judged query cannot dominate the overall number.
    """
    deduplicated = _deduplicate(judgments)
    known_ids = {query.query_id for query in queries}

    run_rates: dict[tuple[str, str], dict[str, int]] = {}
    total_fit = 0
    total_unfit = 0
    total_unsure = 0
    for judgment in deduplicated:
        if judgment.query_id not in known_ids:
            continue
        counts = run_rates.setdefault(
            (judgment.query_id, judgment.evaluator),
            {"FIT": 0, "UNFIT": 0, "UNSURE": 0},
        )
        counts[judgment.fit] += 1
        if judgment.fit == "FIT":
            total_fit += 1
        elif judgment.fit == "UNFIT":
            total_unfit += 1
        else:
            total_unsure += 1

    per_query: dict[str, dict[str, Any]] = {}
    for (query_id, evaluator), counts in run_rates.items():
        entry = per_query.setdefault(
            query_id,
            {"evaluators": [], "run_fit_rates": []},
        )
        entry["evaluators"].append(evaluator)
        judged = counts["FIT"] + counts["UNFIT"]
        if judged > 0:
            entry["run_fit_rates"].append(counts["FIT"] / judged)

    query_summaries = []
    macro_rates = []
    for query in queries:
        entry = per_query.get(query.query_id)
        if entry is None:
            query_summaries.append(
                {
                    "query_id": query.query_id,
                    "evaluator_count": 0,
                    "fit_rate": None,
                }
            )
            continue
        rates = entry["run_fit_rates"]
        fit_rate = round(mean(rates), 4) if rates else None
        if fit_rate is not None:
            macro_rates.append(fit_rate)
        query_summaries.append(
            {
                "query_id": query.query_id,
                "evaluator_count": len(set(entry["evaluators"])),
                "fit_rate": fit_rate,
            }
        )

    evaluator_progress: dict[str, set[str]] = {}
    for query_id, evaluator in run_rates:
        evaluator_progress.setdefault(evaluator, set()).add(query_id)

    micro_total = total_fit + total_unfit
    return {
        "schema_version": "recommendation-tpo-summary-v1",
        "query_count": len(queries),
        "judged_query_count": len(per_query),
        "macro_fit_rate": (
            round(mean(macro_rates), 4) if macro_rates else None
        ),
        "micro_fit_rate": (
            round(total_fit / micro_total, 4) if micro_total else None
        ),
        "counts": {
            "fit": total_fit,
            "unfit": total_unfit,
            "unsure": total_unsure,
        },
        "queries": query_summaries,
        "evaluators": {
            evaluator: {
                "judged_queries": len(query_ids),
                "remaining_queries": len(known_ids - query_ids),
            }
            for evaluator, query_ids in sorted(
                evaluator_progress.items()
            )
        },
    }


__all__ = [
    "FIT_VALUES",
    "TPO_JUDGMENT_SCHEMA_VERSION",
    "TPO_QUERY_SCHEMA_VERSION",
    "TpoEvalError",
    "TpoJudgment",
    "TpoQuery",
    "append_judgments",
    "judgment_from_payload",
    "load_judgments",
    "load_tpo_queries",
    "normalize_evaluator",
    "summarize_judgments",
]
