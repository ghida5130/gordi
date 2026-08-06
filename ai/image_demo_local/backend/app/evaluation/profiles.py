from __future__ import annotations

from dataclasses import dataclass

from app.evaluation.fit import FIT_RULE_VERSION
from app.evaluation.models import EvaluationRound


ROUND_1_PROVIDER_IDS = (
    "nano_banana_2",
    "nano_banana_2_lite",
    "gpt_image_2",
    "grok_imagine_quality",
    "krea_2_medium",
    "flux_2_max",
    "mai_image_2_5_pro",
)
ROUND_2_PROVIDER_IDS = (
    "gpt_image_2",
    "nano_banana_2_lite",
    "nano_banana_2",
    "flux_2_max",
)


@dataclass(frozen=True)
class EvaluationProfile:
    evaluation_round: EvaluationRound
    profile_id: str
    prompt_version: str
    fit_rule_version: str | None
    provider_ids: tuple[str, ...]
    allow_local_fallback: bool
    require_complete_provider_set: bool
    role_labeled_references: bool


ROUND_1_PROFILE = EvaluationProfile(
    evaluation_round="ROUND_1",
    profile_id="round-1-baseline",
    prompt_version="canonical-v1",
    fit_rule_version=None,
    provider_ids=ROUND_1_PROVIDER_IDS,
    allow_local_fallback=True,
    require_complete_provider_set=False,
    role_labeled_references=False,
)
ROUND_2_PROFILE = EvaluationProfile(
    evaluation_round="ROUND_2",
    profile_id="round-2-fit-aware",
    prompt_version="canonical-v2-fit-aware",
    fit_rule_version=FIT_RULE_VERSION,
    provider_ids=ROUND_2_PROVIDER_IDS,
    allow_local_fallback=False,
    require_complete_provider_set=True,
    role_labeled_references=True,
)


def normalize_evaluation_round(value: str | int | None) -> EvaluationRound:
    normalized = str(value or "ROUND_1").strip().upper().replace("-", "_")
    aliases = {
        "1": "ROUND_1",
        "ROUND1": "ROUND_1",
        "ROUND_1": "ROUND_1",
        "2": "ROUND_2",
        "ROUND2": "ROUND_2",
        "ROUND_2": "ROUND_2",
    }
    try:
        return aliases[normalized]  # type: ignore[return-value]
    except KeyError as exc:
        raise ValueError("evaluation_round must be 1, 2, ROUND_1, or ROUND_2") from exc


def evaluation_profile(value: str | int | None) -> EvaluationProfile:
    evaluation_round = normalize_evaluation_round(value)
    return ROUND_2_PROFILE if evaluation_round == "ROUND_2" else ROUND_1_PROFILE


def evaluation_round_number(value: str | int | None) -> int:
    return 2 if normalize_evaluation_round(value) == "ROUND_2" else 1


def run_evaluation_round(run: dict) -> EvaluationRound:
    # Historical files predate the field and are always Round 1.
    return normalize_evaluation_round(run.get("evaluation_round", "ROUND_1"))
