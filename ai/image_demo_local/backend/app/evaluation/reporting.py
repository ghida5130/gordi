from __future__ import annotations

import math
from collections import Counter
from statistics import mean, median
from typing import Any


def percentile(values: list[float], quantile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * quantile
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def _timing_summary(values: list[float]) -> dict[str, float | None]:
    return {
        "average_ms": round(mean(values), 1) if values else None,
        "median_ms": round(median(values), 1) if values else None,
        "p95_ms": round(percentile(values, 0.95), 1) if values else None,
    }


def team_evaluation_summary(run: dict[str, Any]) -> dict[str, Any]:
    pair_count = len(run.get("pairs", []))
    votes_by_evaluator: dict[str, set[str]] = {}
    for vote in run.get("votes", []):
        evaluator_id = vote.get("evaluator_id")
        pair_id = vote.get("pair_id")
        if evaluator_id and pair_id:
            votes_by_evaluator.setdefault(evaluator_id, set()).add(pair_id)

    participants = []
    for evaluator_id, pair_ids in sorted(votes_by_evaluator.items()):
        completed_pairs = len(pair_ids)
        participants.append(
            {
                "evaluator_id": evaluator_id,
                "completed_pairs": completed_pairs,
                "required_pairs": pair_count,
                "completion_rate": round(
                    completed_pairs / pair_count * 100, 1
                )
                if pair_count
                else 0,
                "completed": bool(pair_count and completed_pairs >= pair_count),
            }
        )

    submitted_votes = sum(len(pair_ids) for pair_ids in votes_by_evaluator.values())
    possible_votes = pair_count * len(participants)
    return {
        "evaluator_count": len(participants),
        "completed_evaluator_count": sum(item["completed"] for item in participants),
        "pair_count": pair_count,
        "submitted_votes": submitted_votes,
        "possible_votes": possible_votes,
        "completion_rate": round(submitted_votes / possible_votes * 100, 1)
        if possible_votes
        else 0,
        "participants": participants,
    }


def operations_summary(
    runs: list[dict[str, Any]], provider_catalog: list[dict[str, Any]]
) -> dict[str, Any]:
    catalog = {item["provider_id"]: item for item in provider_catalog}
    real_runs = [run for run in runs if not run.get("mock_mode", False)]
    grouped: dict[str, list[dict[str, Any]]] = {
        provider_id: [] for provider_id in catalog
    }
    for run in real_runs:
        for attempt in run.get("provider_attempts", []):
            provider_id = attempt.get("provider_id")
            if provider_id:
                grouped.setdefault(provider_id, []).append(attempt)

    providers = []
    for provider_id, attempts in grouped.items():
        info = catalog.get(
            provider_id,
            {
                "provider_id": provider_id,
                "display_name": provider_id,
                "model": "unknown",
                "is_fallback": False,
            },
        )
        external_attempts = [
            item
            for item in attempts
            if item.get(
                "external_request_made",
                item.get("status") in {"SUCCEEDED", "FAILED"},
            )
        ]
        successes = [
            item for item in external_attempts if item.get("status") == "SUCCEEDED"
        ]
        failures = [
            item for item in external_attempts if item.get("status") == "FAILED"
        ]
        skipped = [item for item in attempts if item.get("status") == "SKIPPED"]
        latency_values = [
            float(item["latency_ms"])
            for item in successes
            if item.get("latency_ms") is not None
        ]
        generation_values = [
            float(item["generation_time_ms"])
            for item in successes
            if item.get("generation_time_ms") is not None
        ]
        known_costs = [
            float(item["cost_usd"])
            for item in successes
            if item.get("cost_usd") is not None
        ]
        error_categories = Counter(
            item.get("error_category", "UNKNOWN") for item in failures
        )
        skip_categories = Counter(
            item.get("error_category", "UNKNOWN") for item in skipped
        )
        actual_call_count = len(external_attempts)
        success_count = len(successes)
        providers.append(
            {
                **info,
                "attempt_count": len(attempts),
                "actual_call_count": actual_call_count,
                "success_count": success_count,
                "failure_count": len(failures),
                "skipped_count": len(skipped),
                "success_rate": round(success_count / actual_call_count * 100, 1)
                if actual_call_count
                else None,
                "latency": _timing_summary(latency_values),
                "generation_time": _timing_summary(generation_values),
                "cost": {
                    "known_success_count": len(known_costs),
                    "average_per_success_usd": round(mean(known_costs), 6)
                    if known_costs
                    else None,
                    "total_usd": round(sum(known_costs), 6),
                },
                "error_categories": dict(sorted(error_categories.items())),
                "skip_categories": dict(sorted(skip_categories.items())),
                "last_checked_at": max(
                    (
                        item.get("checked_at", "")
                        for item in attempts
                        if item.get("checked_at")
                    ),
                    default=None,
                ),
            }
        )

    providers.sort(key=lambda item: (item["is_fallback"], item["display_name"]))
    return {
        "real_run_count": len(real_runs),
        "actual_call_count": sum(item["actual_call_count"] for item in providers),
        "success_count": sum(item["success_count"] for item in providers),
        "failure_count": sum(item["failure_count"] for item in providers),
        "total_cost_usd": round(
            sum(item["cost"]["total_usd"] for item in providers), 6
        ),
        "providers": providers,
    }
