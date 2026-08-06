from __future__ import annotations

import asyncio
import hashlib
import itertools
import random
import secrets
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

from app.core.config import Settings
from app.evaluation.fit import resolve_garment_metadata
from app.evaluation.images import make_mock_output
from app.evaluation.models import (
    AvatarProfile,
    EvaluationRound,
    GarmentMetadata,
    VoteRequest,
)
from app.evaluation.profiles import (
    evaluation_round_number,
    evaluation_profile,
    run_evaluation_round,
)
from app.evaluation.prompt import build_prompt
from app.evaluation.providers import (
    BaseProvider,
    FluxKleinProvider,
    ImageInput,
    ProviderResult,
    ProviderUnavailable,
    commercial_providers,
)
from app.evaluation.reporting import operations_summary, team_evaluation_summary
from app.evaluation.store import RunStore


QUALITY_DIMENSIONS = (
    "garment_fidelity",
    "body_fidelity",
    "realism",
    "artifact_control",
)


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def _opaque_id(prefix: str = "") -> str:
    return f"{prefix}{secrets.token_urlsafe(8)}"


def create_pairings(candidate_ids: list[str], seed: str) -> list[dict[str, str]]:
    pairs = list(itertools.combinations(candidate_ids, 2))
    rng = random.Random(seed)
    rng.shuffle(pairs)
    result = []
    for left, right in pairs:
        if rng.random() < 0.5:
            left, right = right, left
        digest = hashlib.sha256(f"{seed}:{left}:{right}".encode()).hexdigest()[:16]
        result.append({"pair_id": f"pair_{digest}", "left": left, "right": right})
    return result


def score_summary(run: dict[str, Any]) -> list[dict[str, Any]]:
    candidate_ids = [candidate["candidate_id"] for candidate in run["candidates"]]
    stats = {
        candidate_id: {
            "wins": 0,
            "ties": 0,
            "losses": 0,
            "neither": 0,
            "quality_total": 0,
            "quality_count": 0,
            "quality_dimensions": {
                dimension: {"total": 0, "count": 0}
                for dimension in QUALITY_DIMENSIONS
            },
        }
        for candidate_id in candidate_ids
    }
    pair_map = {pair["pair_id"]: pair for pair in run["pairs"]}
    for vote in run.get("votes", []):
        pair = pair_map.get(vote["pair_id"])
        if not pair:
            continue
        left, right = pair["left"], pair["right"]
        winner = vote["winner"]
        if winner == "LEFT":
            stats[left]["wins"] += 1
            stats[right]["losses"] += 1
        elif winner == "RIGHT":
            stats[right]["wins"] += 1
            stats[left]["losses"] += 1
        elif winner == "TIE":
            stats[left]["ties"] += 1
            stats[right]["ties"] += 1
        else:
            stats[left]["neither"] += 1
            stats[right]["neither"] += 1
        for side, candidate_id in (("left_scores", left), ("right_scores", right)):
            score_values = vote[side].values()
            stats[candidate_id]["quality_total"] += sum(score_values) / len(vote[side])
            stats[candidate_id]["quality_count"] += 1
            for dimension in QUALITY_DIMENSIONS:
                score = vote[side].get(dimension)
                if score is not None:
                    dimension_stats = stats[candidate_id]["quality_dimensions"][dimension]
                    dimension_stats["total"] += score
                    dimension_stats["count"] += 1

    provider_by_candidate = {
        item["candidate_id"]: item for item in run["candidates"]
    }
    ranking = []
    for candidate_id, values in stats.items():
        comparisons = values["wins"] + values["ties"] + values["losses"] + values["neither"]
        preference_score = (
            (values["wins"] + 0.5 * values["ties"]) / comparisons * 100
            if comparisons
            else 0
        )
        quality_average = (
            values["quality_total"] / values["quality_count"]
            if values["quality_count"]
            else 0
        )
        composite_score = 0.6 * preference_score + 0.4 * (quality_average / 5 * 100)
        candidate = provider_by_candidate[candidate_id]
        ranking.append(
            {
                "candidate_id": candidate_id,
                "provider_id": candidate["provider_id"],
                "display_name": candidate["display_name"],
                "official_model": candidate["model"],
                "input_strategy": candidate["input_strategy"],
                "is_fallback": candidate["is_fallback"],
                "wins": values["wins"],
                "ties": values["ties"],
                "losses": values["losses"],
                "neither": values["neither"],
                "preference_score": round(preference_score, 1),
                "quality_average": round(quality_average, 2),
                "quality_rating_count": values["quality_count"],
                "quality_dimensions": {
                    dimension: round(item["total"] / item["count"], 2)
                    if item["count"]
                    else 0
                    for dimension, item in values["quality_dimensions"].items()
                },
                "composite_score": round(composite_score, 1),
                "latency_ms": candidate.get("latency_ms"),
                "cost_usd": candidate.get("cost_usd"),
            }
        )
    return sorted(ranking, key=lambda item: (-item["composite_score"], item["display_name"]))


class EvaluationService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.store = RunStore(Path(settings.demo_data_dir))

    def provider_setup(
        self,
        evaluation_round: EvaluationRound = "ROUND_1",
    ) -> dict[str, Any]:
        profile = evaluation_profile(evaluation_round)
        commercial = commercial_providers(self.settings, evaluation_round)
        fallback = FluxKleinProvider(self.settings)
        return {
            "evaluation_round": evaluation_round_number(evaluation_round),
            "evaluation_profile": profile.profile_id,
            "prompt_version": profile.prompt_version,
            "commercial_candidate_count": len(commercial),
            "configured_commercial_count": sum(item.configured for item in commercial),
            "fallback_configured": (
                fallback.configured if profile.allow_local_fallback else False
            ),
            "mock_mode_available": True,
        }

    def _provider_catalog(
        self,
        evaluation_round: EvaluationRound = "ROUND_1",
    ) -> list[dict[str, Any]]:
        profile = evaluation_profile(evaluation_round)
        providers = [
            *commercial_providers(self.settings, evaluation_round),
        ]
        if profile.allow_local_fallback:
            providers.append(FluxKleinProvider(self.settings))
        return [
            {
                "provider_id": provider.provider_id,
                "display_name": provider.display_name,
                "model": provider.model,
                "input_strategy": provider.input_strategy,
                "is_fallback": provider.is_fallback,
            }
            for provider in providers
        ]

    def operational_summary(
        self,
        evaluation_round: EvaluationRound = "ROUND_1",
    ) -> dict[str, Any]:
        runs = [
            run
            for run in self.store.all()
            if run_evaluation_round(run) == evaluation_round
        ]
        return operations_summary(runs, self._provider_catalog(evaluation_round))

    @staticmethod
    def _evaluator_run_progress(
        run: dict[str, Any], evaluator_id: str
    ) -> tuple[int, int, bool]:
        required_pair_ids = {
            pair["pair_id"] for pair in run.get("pairs", []) if pair.get("pair_id")
        }
        voted_pair_ids = {
            vote["pair_id"]
            for vote in run.get("votes", [])
            if vote.get("evaluator_id") == evaluator_id and vote.get("pair_id")
        }
        completed = bool(
            run.get("status") == "READY"
            and required_pair_ids
            and required_pair_ids.issubset(voted_pair_ids)
        )
        return len(voted_pair_ids & required_pair_ids), len(required_pair_ids), completed

    def dashboard(
        self,
        evaluator_id: str,
        evaluation_round: EvaluationRound = "ROUND_1",
    ) -> dict[str, Any]:
        real_runs = [
            run
            for run in self.store.all()
            if not run.get("mock_mode", False)
            and run_evaluation_round(run) == evaluation_round
        ]
        progress_by_run = {
            run["run_id"]: self._evaluator_run_progress(run, evaluator_id)
            for run in real_runs
        }
        completed_run_count = sum(
            progress[2] for progress in progress_by_run.values()
        )
        if not completed_run_count:
            raise PermissionError("실제 블라인드 테스트를 먼저 완료해 주세요.")

        aggregate: dict[str, dict[str, Any]] = {}
        run_items = []
        evaluated_run_count = 0
        total_team_votes = 0
        for run in real_runs:
            votes = run.get("votes", [])
            total_team_votes += len(votes)
            ranking = score_summary(run) if run.get("candidates") else []
            has_evaluation = bool(votes and any(
                item["quality_rating_count"] for item in ranking
            ))
            if has_evaluation:
                evaluated_run_count += 1

            for index, item in enumerate(ranking):
                comparison_count = (
                    item["wins"]
                    + item["ties"]
                    + item["losses"]
                    + item["neither"]
                )
                rating_count = item["quality_rating_count"]
                if not comparison_count and not rating_count:
                    continue
                stats = aggregate.setdefault(
                    item["provider_id"],
                    {
                        "provider_id": item["provider_id"],
                        "display_name": item["display_name"],
                        "official_model": item["official_model"],
                        "input_strategy": item["input_strategy"],
                        "is_fallback": item["is_fallback"],
                        "case_count": 0,
                        "best_count": 0,
                        "wins": 0,
                        "ties": 0,
                        "losses": 0,
                        "neither": 0,
                        "quality_total": 0.0,
                        "quality_count": 0,
                        "dimension_totals": {
                            dimension: 0.0 for dimension in QUALITY_DIMENSIONS
                        },
                    },
                )
                stats["case_count"] += 1
                if has_evaluation and index == 0:
                    stats["best_count"] += 1
                for field in ("wins", "ties", "losses", "neither"):
                    stats[field] += item[field]
                stats["quality_total"] += item["quality_average"] * rating_count
                stats["quality_count"] += rating_count
                for dimension in QUALITY_DIMENSIONS:
                    stats["dimension_totals"][dimension] += (
                        item["quality_dimensions"][dimension] * rating_count
                    )

            evaluator_votes, required_votes, evaluator_completed = progress_by_run[
                run["run_id"]
            ]
            team_summary = team_evaluation_summary(run)
            run_items.append(
                {
                    "run_id": run["run_id"],
                    "scenario_name": run.get("scenario_name", "Untitled"),
                    "status": run.get("status"),
                    "created_at": run.get("created_at"),
                    "completed_at": run.get("completed_at"),
                    "candidate_count": run.get("candidate_count", 0),
                    "pair_count": len(run.get("pairs", [])),
                    "team_vote_count": len(votes),
                    "team_evaluator_count": team_summary["evaluator_count"],
                    "evaluator_vote_count": evaluator_votes,
                    "evaluator_required_vote_count": required_votes,
                    "evaluator_completed": evaluator_completed,
                    "top_model": ranking[0]["display_name"]
                    if has_evaluation and ranking
                    else None,
                }
            )

        combined_ranking = []
        for stats in aggregate.values():
            comparisons = (
                stats["wins"]
                + stats["ties"]
                + stats["losses"]
                + stats["neither"]
            )
            preference_score = (
                (stats["wins"] + 0.5 * stats["ties"]) / comparisons * 100
                if comparisons
                else 0
            )
            quality_average = (
                stats["quality_total"] / stats["quality_count"]
                if stats["quality_count"]
                else 0
            )
            combined_ranking.append(
                {
                    key: stats[key]
                    for key in (
                        "provider_id",
                        "display_name",
                        "official_model",
                        "input_strategy",
                        "is_fallback",
                        "case_count",
                        "best_count",
                        "wins",
                        "ties",
                        "losses",
                        "neither",
                    )
                }
                | {
                    "preference_score": round(preference_score, 1),
                    "quality_average": round(quality_average, 2),
                    "quality_rating_count": stats["quality_count"],
                    "quality_dimensions": {
                        dimension: round(
                            stats["dimension_totals"][dimension]
                            / stats["quality_count"],
                            2,
                        )
                        if stats["quality_count"]
                        else 0
                        for dimension in QUALITY_DIMENSIONS
                    },
                    "composite_score": round(
                        0.6 * preference_score + 0.4 * (quality_average / 5 * 100),
                        1,
                    ),
                }
            )

        combined_ranking.sort(
            key=lambda item: (-item["composite_score"], item["display_name"])
        )
        run_items.sort(key=lambda item: item.get("created_at") or "", reverse=True)
        return {
            "evaluator_id": evaluator_id,
            "evaluation_round": evaluation_round_number(evaluation_round),
            "evaluation_profile": evaluation_profile(evaluation_round).profile_id,
            "completed_real_run_count": completed_run_count,
            "real_run_count": len(real_runs),
            "evaluated_run_count": evaluated_run_count,
            "total_team_votes": total_team_votes,
            "ranking": combined_ranking,
            "runs": run_items,
            "operations": operations_summary(
                real_runs,
                self._provider_catalog(evaluation_round),
            ),
            "method": {
                "preference_weight": 0.6,
                "quality_weight": 0.4,
                "mock_runs_excluded": True,
                "quality_average_weighted_by_rating_count": True,
            },
        }

    def create_run(
        self,
        *,
        scenario_name: str,
        avatar: bytes,
        garments: list[bytes],
        metadata: list[GarmentMetadata],
        mock_mode: bool,
        evaluation_round: EvaluationRound = "ROUND_1",
        avatar_profile: AvatarProfile | None = None,
    ) -> dict[str, Any]:
        profile = evaluation_profile(evaluation_round)
        resolved_metadata = (
            resolve_garment_metadata(metadata, avatar_profile)
            if evaluation_round == "ROUND_2"
            else metadata
        )
        canonical_prompt = build_prompt(
            resolved_metadata,
            evaluation_round=evaluation_round,
            avatar_profile=avatar_profile,
        )
        run_id = uuid.uuid4().hex
        avatar_url = f"/demo-media/{run_id}/avatar.png"
        garment_urls = [f"/demo-media/{run_id}/garment-{index + 1}.png" for index in range(len(garments))]
        run = {
            "run_id": run_id,
            "scenario_name": scenario_name,
            "evaluation_round": evaluation_round_number(evaluation_round),
            "evaluation_profile": profile.profile_id,
            "prompt_version": profile.prompt_version,
            "fit_rule_version": profile.fit_rule_version,
            "canonical_prompt": canonical_prompt,
            "avatar_profile": (
                avatar_profile.model_dump() if avatar_profile is not None else None
            ),
            "expected_provider_ids": list(profile.provider_ids),
            "expected_candidate_count": len(profile.provider_ids),
            "missing_provider_ids": list(profile.provider_ids),
            "status": "QUEUED",
            "mock_mode": mock_mode,
            "created_at": utc_now(),
            "completed_at": None,
            "references": {
                "avatar_url": avatar_url,
                "garments": [
                    {"image_url": garment_urls[index], **item.model_dump()}
                    for index, item in enumerate(resolved_metadata)
                ],
            },
            "candidate_count": 0,
            "candidates": [],
            "pairs": [],
            "votes": [],
            "provider_attempts": [],
        }
        self.store.create(run_id, run)
        self.store.write_asset(run_id, "avatar.png", avatar)
        for index, garment in enumerate(garments):
            self.store.write_asset(run_id, f"garment-{index + 1}.png", garment)
        return run

    async def process_run(
        self,
        run_id: str,
        avatar: bytes,
        garments: list[bytes],
        metadata: list[GarmentMetadata],
        avatar_profile: AvatarProfile | None = None,
    ) -> None:
        run = self.store.get(run_id)
        evaluation_round = run_evaluation_round(run)
        profile = evaluation_profile(evaluation_round)
        if avatar_profile is None and run.get("avatar_profile"):
            avatar_profile = AvatarProfile.model_validate(run["avatar_profile"])
        resolved_metadata = (
            resolve_garment_metadata(metadata, avatar_profile)
            if evaluation_round == "ROUND_2"
            else metadata
        )
        run["status"] = "PROCESSING"
        self.store.save(run_id, run)

        providers = commercial_providers(self.settings, evaluation_round)
        if run["mock_mode"]:
            results = [
                ProviderResult(
                    provider_id=provider.provider_id,
                    model=provider.model,
                    image=make_mock_output(avatar, index),
                    mime_type="image/jpeg",
                    latency_ms=500 + index * 173,
                    input_strategy=provider.input_strategy,
                )
                for index, provider in enumerate(providers)
            ]
            attempts = [
                {
                    "provider_id": provider.provider_id,
                    "model": provider.model,
                    "status": "MOCKED",
                    "external_request_made": False,
                    "latency_ms": None,
                    "generation_time_ms": None,
                    "cost_usd": None,
                    "error_category": None,
                    "error_code": None,
                    "error": None,
                    "retryable": False,
                    "checked_at": utc_now(),
                }
                for provider in providers
            ]
        elif (
            profile.require_complete_provider_set
            and not all(provider.configured for provider in providers)
        ):
            missing_provider_ids = [
                provider.provider_id
                for provider in providers
                if not provider.configured
            ]
            results = []
            attempts = [
                {
                    "provider_id": provider.provider_id,
                    "model": provider.model,
                    "status": "SKIPPED",
                    "external_request_made": False,
                    "latency_ms": None,
                    "generation_time_ms": None,
                    "cost_usd": None,
                    "error_category": (
                        "NOT_CONFIGURED"
                        if provider.provider_id in missing_provider_ids
                        else "INCOMPLETE_PROVIDER_SET"
                    ),
                    "error_code": (
                        "not_configured"
                        if provider.provider_id in missing_provider_ids
                        else "round_2_preflight_failed"
                    ),
                    "error": (
                        f"{provider.display_name} is not configured"
                        if provider.provider_id in missing_provider_ids
                        else (
                            "Round 2 was not started because every fixed provider "
                            "must be configured before any billable request"
                        )
                    ),
                    "retryable": False,
                    "checked_at": utc_now(),
                }
                for provider in providers
            ]
        else:
            results, attempts = await self._run_commercial(
                providers,
                avatar,
                garments,
                resolved_metadata,
                avatar_profile,
            )
            if not results and profile.allow_local_fallback:
                fallback = FluxKleinProvider(self.settings)
                fallback_result, fallback_attempt = await self._call_provider(
                    fallback,
                    avatar,
                    garments,
                    resolved_metadata,
                    avatar_profile,
                )
                attempts.append(fallback_attempt)
                if fallback_result:
                    results.append(fallback_result)

        run = self.store.get(run_id)
        run["provider_attempts"] = attempts
        candidates = []
        provider_lookup = {
            provider.provider_id: provider for provider in providers
        }
        if profile.allow_local_fallback:
            fallback = FluxKleinProvider(self.settings)
            provider_lookup[fallback.provider_id] = fallback
        for result in results:
            candidate_id = _opaque_id("cand_")
            output_id = _opaque_id("output_")
            extension = {
                "image/jpeg": "jpg",
                "image/webp": "webp",
            }.get(result.mime_type, "png")
            image_url = self.store.write_asset(
                run_id, f"{output_id}.{extension}", result.image
            )
            provider = provider_lookup[result.provider_id]
            candidates.append(
                {
                    "candidate_id": candidate_id,
                    "image_url": image_url,
                    "provider_id": result.provider_id,
                    "display_name": provider.display_name,
                    "model": result.model,
                    "input_strategy": result.input_strategy,
                    "is_fallback": provider.is_fallback,
                    "latency_ms": result.latency_ms,
                    "generation_time_ms": result.generation_time_ms,
                    "cost_usd": result.cost_usd,
                }
            )

        run["candidates"] = candidates
        run["candidate_count"] = len(candidates)
        succeeded_provider_ids = {
            candidate["provider_id"] for candidate in candidates
        }
        run["missing_provider_ids"] = [
            provider_id
            for provider_id in profile.provider_ids
            if provider_id not in succeeded_provider_ids
        ]
        run["pairs"] = create_pairings(
            [candidate["candidate_id"] for candidate in candidates], run_id
        )
        run["completed_at"] = utc_now()
        complete_provider_set = not run["missing_provider_ids"]
        run["status"] = (
            "READY"
            if (
                complete_provider_set
                if profile.require_complete_provider_set
                else len(candidates) >= 2
            )
            else "INSUFFICIENT_RESULTS"
        )
        self.store.save(run_id, run)

    async def _run_commercial(
        self,
        providers: list[BaseProvider],
        avatar: bytes,
        garments: list[bytes],
        metadata: list[GarmentMetadata],
        avatar_profile: AvatarProfile | None = None,
    ) -> tuple[list[ProviderResult], list[dict[str, Any]]]:
        calls = [
            self._call_provider(
                provider,
                avatar,
                garments,
                metadata,
                avatar_profile,
            )
            for provider in providers
        ]
        outcomes = await asyncio.gather(*calls)
        return (
            [result for result, _ in outcomes if result is not None],
            [attempt for _, attempt in outcomes],
        )

    async def _call_provider(
        self,
        provider: BaseProvider,
        avatar: bytes,
        garments: list[bytes],
        metadata: list[GarmentMetadata],
        avatar_profile: AvatarProfile | None = None,
    ) -> tuple[ProviderResult | None, dict[str, Any]]:
        started = time.perf_counter()
        try:
            result = await provider.generate(
                ImageInput("avatar.png", avatar),
                [ImageInput(f"garment-{index + 1}.png", item) for index, item in enumerate(garments)],
                metadata,
                avatar_profile,
            )
            return result, {
                "provider_id": provider.provider_id,
                "model": result.model,
                "status": "SUCCEEDED",
                "external_request_made": True,
                "latency_ms": result.latency_ms,
                "generation_time_ms": result.generation_time_ms,
                "gateway_latency_ms": result.gateway_latency_ms,
                "provider_name": result.provider_name,
                "generation_id": result.generation_id,
                "cost_usd": result.cost_usd,
                "prompt_tokens": result.prompt_tokens,
                "completion_tokens": result.completion_tokens,
                "total_tokens": result.total_tokens,
                "error_category": None,
                "error_code": None,
                "error": None,
                "retryable": False,
                "retry_after_seconds": None,
                "checked_at": utc_now(),
            }
        except Exception as exc:  # provider errors are intentionally isolated
            elapsed_ms = round((time.perf_counter() - started) * 1000)
            failure = self._classify_provider_error(exc)
            return None, {
                "provider_id": provider.provider_id,
                "model": provider.model,
                "latency_ms": elapsed_ms if failure["external_request_made"] else None,
                "generation_time_ms": None,
                "gateway_latency_ms": None,
                "provider_name": None,
                "generation_id": None,
                "cost_usd": None,
                "prompt_tokens": None,
                "completion_tokens": None,
                "total_tokens": None,
                "checked_at": utc_now(),
                **failure,
            }

    @staticmethod
    def _classify_provider_error(exc: Exception) -> dict[str, Any]:
        if isinstance(exc, ProviderUnavailable):
            return {
                "status": "SKIPPED",
                "external_request_made": False,
                "error_category": exc.category,
                "error_code": exc.category.lower(),
                "error": str(exc),
                "retryable": False,
                "retry_after_seconds": None,
            }

        if isinstance(exc, httpx.TimeoutException):
            return {
                "status": "FAILED",
                "external_request_made": True,
                "error_category": "TIMEOUT",
                "error_code": "timeout",
                "error": "Image provider request timed out",
                "retryable": True,
                "retry_after_seconds": None,
            }

        if isinstance(exc, httpx.HTTPStatusError):
            response = exc.response
            status_code = response.status_code
            error_code: str | None = None
            message = response.reason_phrase or "Provider request failed"
            try:
                payload = response.json()
                error = payload.get("error", {}) if isinstance(payload, dict) else {}
                if isinstance(error, dict):
                    metadata = error.get("metadata", {})
                    error_code = (
                        metadata.get("error_type")
                        if isinstance(metadata, dict)
                        else None
                    ) or error.get("code") or error.get("type")
                    if error.get("message"):
                        message = str(error["message"])
            except ValueError:
                pass

            normalized = str(error_code or "").lower()
            if "content" in normalized or "moderation" in normalized:
                category = "CONTENT_POLICY"
            elif status_code in {400, 422}:
                category = "INPUT_CONSTRAINT"
            elif status_code == 401:
                category = "AUTHENTICATION"
            elif status_code == 402:
                category = "INSUFFICIENT_CREDITS"
            elif status_code == 403:
                category = "PERMISSION_OR_POLICY"
            elif status_code == 404:
                category = "UNSUPPORTED_MODEL"
            elif status_code == 408:
                category = "TIMEOUT"
            elif status_code == 429:
                category = "RATE_LIMIT"
            elif status_code >= 500:
                category = "PROVIDER_5XX"
            else:
                category = "HTTP_ERROR"

            retry_after = response.headers.get("Retry-After")
            try:
                retry_after_seconds = float(retry_after) if retry_after else None
            except ValueError:
                retry_after_seconds = None
            return {
                "status": "FAILED",
                "external_request_made": True,
                "http_status": status_code,
                "error_category": category,
                "error_code": str(error_code or f"http_{status_code}"),
                "error": message[:200],
                "retryable": status_code in {408, 429} or status_code >= 500,
                "retry_after_seconds": retry_after_seconds,
            }

        if isinstance(exc, httpx.RequestError):
            return {
                "status": "FAILED",
                "external_request_made": True,
                "error_category": "NETWORK",
                "error_code": "network_error",
                "error": "Could not reach the image provider",
                "retryable": True,
                "retry_after_seconds": None,
            }

        return {
            "status": "FAILED",
            "external_request_made": True,
            "error_category": "INTERNAL",
            "error_code": type(exc).__name__,
            "error": str(exc)[:200],
            "retryable": False,
            "retry_after_seconds": None,
        }

    def public_run(self, run_id: str, evaluator_id: str | None) -> dict[str, Any]:
        run = self.store.get(run_id)
        voted = {
            vote["pair_id"]
            for vote in run.get("votes", [])
            if evaluator_id and vote["evaluator_id"] == evaluator_id
        }
        candidates = {item["candidate_id"]: item for item in run["candidates"]}
        pairs = [
            {
                "pair_id": pair["pair_id"],
                "left": {
                    "candidate_id": pair["left"],
                    "image_url": candidates[pair["left"]]["image_url"],
                },
                "right": {
                    "candidate_id": pair["right"],
                    "image_url": candidates[pair["right"]]["image_url"],
                },
            }
            for pair in run["pairs"]
        ]
        return {
            "run_id": run["run_id"],
            "scenario_name": run["scenario_name"],
            "evaluation_round": evaluation_round_number(run_evaluation_round(run)),
            "evaluation_profile": run.get("evaluation_profile", "round-1-baseline"),
            "prompt_version": run.get("prompt_version", "canonical-v1"),
            "fit_rule_version": run.get("fit_rule_version"),
            "avatar_profile": run.get("avatar_profile"),
            "status": run["status"],
            "mock_mode": run["mock_mode"],
            "created_at": run["created_at"],
            "completed_at": run["completed_at"],
            "references": run["references"],
            "candidate_count": run["candidate_count"],
            "pair_count": len(run["pairs"]),
            "team_vote_count": len(run.get("votes", [])),
            "voted_pair_ids": sorted(voted),
            "pairs": pairs,
        }

    def vote(self, run_id: str, pair_id: str, vote: VoteRequest) -> dict[str, Any]:
        run = self.store.get(run_id)
        if run["status"] != "READY":
            raise ValueError("Run is not ready for evaluation")
        if pair_id not in {pair["pair_id"] for pair in run["pairs"]}:
            raise KeyError(pair_id)
        record = {"pair_id": pair_id, **vote.model_dump(), "submitted_at": utc_now()}
        run["votes"] = [
            item
            for item in run.get("votes", [])
            if not (item["pair_id"] == pair_id and item["evaluator_id"] == vote.evaluator_id)
        ]
        run["votes"].append(record)
        self.store.save(run_id, run)
        return {"saved": True, "pair_id": pair_id}

    def reveal(self, run_id: str) -> dict[str, Any]:
        run = self.store.get(run_id)
        if run["status"] not in {"READY", "INSUFFICIENT_RESULTS"}:
            raise ValueError("Run has not completed")
        ranking = score_summary(run)
        evaluation_round = run_evaluation_round(run)
        return {
            "run_id": run_id,
            "evaluation_round": evaluation_round_number(evaluation_round),
            "evaluation_profile": run.get("evaluation_profile", "round-1-baseline"),
            "prompt_version": run.get("prompt_version", "canonical-v1"),
            "fit_rule_version": run.get("fit_rule_version"),
            "mock_mode": run["mock_mode"],
            "ranking": ranking,
            "best": ranking[0] if ranking else None,
            "runner_up": ranking[1] if len(ranking) > 1 else None,
            "attempts": run["provider_attempts"],
            "team_summary": team_evaluation_summary(run),
            "operations": self.operational_summary(evaluation_round),
            "method": {
                "preference_weight": 0.6,
                "quality_weight": 0.4,
                "quality_dimensions": [
                    "garment_fidelity",
                    "body_fidelity",
                    "realism",
                    "artifact_control",
                ],
            },
        }
