"""Blind A/B judgments for VLM rerank on/off quality comparison.

Query set reuses the TPO eval schema (6-query subset for fast
rounds). Judgments are per-(evaluator, query) preference votes over
two blinded arms; re-voting supersedes at aggregation time, same
append-only convention as tpo_eval.
"""

from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.recommendation.tpo_eval import (
    TpoEvalError,
    normalize_evaluator,
)

VLM_AB_JUDGMENT_SCHEMA_VERSION = "recommendation-vlm-ab-judgment-v1"
VARIANTS = ("VLM_ON", "VLM_OFF")
PREFERENCES = ("VLM_ON", "VLM_OFF", "TIE")

_APPEND_LOCK = threading.Lock()


@dataclass(frozen=True)
class VlmAbJudgment:
    evaluator: str
    query_id: str
    preferred: str
    index_version: str
    latency_on_ms: int
    latency_off_ms: int
    judged_at: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "schema_version": VLM_AB_JUDGMENT_SCHEMA_VERSION,
            "evaluator": self.evaluator,
            "query_id": self.query_id,
            "preferred": self.preferred,
            "index_version": self.index_version,
            "latency_on_ms": self.latency_on_ms,
            "latency_off_ms": self.latency_off_ms,
            "judged_at": self.judged_at,
        }


def judgment_from_payload(payload: dict[str, Any]) -> VlmAbJudgment:
    preferred = payload.get("preferred")
    if preferred not in PREFERENCES:
        raise TpoEvalError(
            f"preferred must be one of {', '.join(PREFERENCES)}"
        )
    latencies = []
    for field in ("latency_on_ms", "latency_off_ms"):
        value = payload.get(field)
        if isinstance(value, bool) or not isinstance(value, int):
            raise TpoEvalError(f"{field} must be an integer")
        if value < 0:
            raise TpoEvalError(f"{field} must be non-negative")
        latencies.append(value)
    return VlmAbJudgment(
        evaluator=normalize_evaluator(
            str(payload.get("evaluator", ""))
        ),
        query_id=str(payload.get("query_id", "")),
        preferred=str(preferred),
        index_version=str(payload.get("index_version", "")),
        latency_on_ms=latencies[0],
        latency_off_ms=latencies[1],
        judged_at=str(payload.get("judged_at", "")),
    )


def append_judgment(path: Path, judgment: VlmAbJudgment) -> None:
    with _APPEND_LOCK:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as handle:
            handle.write(
                json.dumps(judgment.as_dict(), ensure_ascii=False)
                + "\n"
            )


def load_judgments(path: Path) -> list[VlmAbJudgment]:
    if not path.exists():
        return []
    judgments: list[VlmAbJudgment] = []
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
            != VLM_AB_JUDGMENT_SCHEMA_VERSION
        ):
            raise TpoEvalError(
                f"unsupported judgment schema on line {line_number}"
            )
        judgments.append(judgment_from_payload(payload))
    return judgments


def summarize_judgments(
    judgments: list[VlmAbJudgment],
    query_ids: list[str],
) -> dict[str, Any]:
    known = set(query_ids)
    latest: dict[tuple[str, str], VlmAbJudgment] = {}
    for judgment in judgments:
        if judgment.query_id not in known:
            continue
        latest[(judgment.evaluator, judgment.query_id)] = judgment
    votes = list(latest.values())

    def count(preference: str) -> int:
        return sum(1 for vote in votes if vote.preferred == preference)

    on_wins, off_wins, ties = (
        count("VLM_ON"),
        count("VLM_OFF"),
        count("TIE"),
    )
    decided = on_wins + off_wins
    per_query = []
    for query_id in query_ids:
        query_votes = [v for v in votes if v.query_id == query_id]
        per_query.append(
            {
                "query_id": query_id,
                "on_wins": sum(
                    1 for v in query_votes if v.preferred == "VLM_ON"
                ),
                "off_wins": sum(
                    1 for v in query_votes if v.preferred == "VLM_OFF"
                ),
                "ties": sum(
                    1 for v in query_votes if v.preferred == "TIE"
                ),
            }
        )
    mean = lambda values: (  # noqa: E731
        round(sum(values) / len(values)) if values else None
    )
    return {
        "schema_version": "recommendation-vlm-ab-summary-v1",
        "votes": len(votes),
        "on_wins": on_wins,
        "off_wins": off_wins,
        "ties": ties,
        "on_win_rate": (
            round(on_wins / decided, 4) if decided else None
        ),
        "queries": per_query,
        "mean_latency_on_ms": mean(
            [v.latency_on_ms for v in votes]
        ),
        "mean_latency_off_ms": mean(
            [v.latency_off_ms for v in votes]
        ),
        "evaluators": sorted(
            {v.evaluator for v in votes}
        ),
    }


__all__ = [
    "PREFERENCES",
    "VARIANTS",
    "VLM_AB_JUDGMENT_SCHEMA_VERSION",
    "VlmAbJudgment",
    "append_judgment",
    "judgment_from_payload",
    "load_judgments",
    "summarize_judgments",
]
