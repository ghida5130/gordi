from __future__ import annotations

import asyncio
import hashlib
import json
from io import BytesIO

import httpx
import pytest
from PIL import Image

from app.main import app
from app.core.config import Settings
from app.evaluation.avatar_presets import resolve_avatar_profile
from app.evaluation.fit import FIT_RULE_VERSION, derive_fit_assessment
from app.evaluation.images import make_reference_sheet
from app.evaluation.models import (
    AvatarProfile,
    AvatarInput,
    CandidateScore,
    GarmentMeasurements,
    GarmentMetadata,
    VoteRequest,
)
from app.evaluation.profiles import ROUND_2_PROVIDER_IDS, normalize_evaluation_round
from app.evaluation.prompt import build_round_two_prompt
from app.evaluation.providers import (
    ImageInput,
    ProviderUnavailable,
    _openrouter_metrics,
    commercial_providers,
)
from app.evaluation.reporting import operations_summary, percentile
from app.evaluation.service import EvaluationService, create_pairings


def image_bytes(color: str) -> bytes:
    output = BytesIO()
    Image.new("RGB", (120, 180), color).save(output, format="PNG")
    return output.getvalue()


def test_mvp_avatar_input_resolves_internal_fit_profile() -> None:
    base = resolve_avatar_profile(
        AvatarInput(
            preset_id="female-hourglass",
            gender="FEMALE",
            height_cm=163,
            weight_kg=57,
        )
    )
    adjusted = resolve_avatar_profile(
        AvatarInput(
            preset_id="female-hourglass",
            gender="FEMALE",
            height_cm=170,
            weight_kg=65,
        )
    )

    assert base.label == "여성 · 모래시계형"
    assert base.waist_circumference_cm == 68
    assert adjusted.height_cm == 170
    assert adjusted.chest_circumference_cm > base.chest_circumference_cm
    assert adjusted.arm_length_cm > base.arm_length_cm


def test_mvp_avatar_input_rejects_gender_mismatch() -> None:
    with pytest.raises(ValueError, match="does not match"):
        resolve_avatar_profile(
            AvatarInput(
                preset_id="female-rectangle",
                gender="MALE",
                height_cm=170,
                weight_kg=65,
            )
        )


def test_mock_run_builds_available_blind_candidates_and_all_pairs(tmp_path) -> None:
    service = EvaluationService(Settings(demo_data_dir=tmp_path))
    avatar = image_bytes("#dddddd")
    garment = image_bytes("#333399")
    metadata = [GarmentMetadata(slot="TOP", caption="navy cotton shirt")]
    run = service.create_run(
        scenario_name="baseline",
        avatar=avatar,
        garments=[garment],
        metadata=metadata,
        mock_mode=True,
    )

    asyncio.run(service.process_run(run["run_id"], avatar, [garment], metadata))
    public = service.public_run(run["run_id"], "tester")

    assert public["status"] == "READY"
    assert public["candidate_count"] == 7
    assert public["pair_count"] == 21
    assert "provider_id" not in public["pairs"][0]["left"]


def test_vote_and_reveal_rank_winner(tmp_path) -> None:
    service = EvaluationService(Settings(demo_data_dir=tmp_path))
    avatar = image_bytes("white")
    garment = image_bytes("black")
    metadata = [GarmentMetadata(slot="TOP", caption="black tee")]
    created = service.create_run(
        scenario_name="ranking",
        avatar=avatar,
        garments=[garment],
        metadata=metadata,
        mock_mode=True,
    )
    asyncio.run(service.process_run(created["run_id"], avatar, [garment], metadata))
    run = service.store.get(created["run_id"])
    favored = run["candidates"][0]["candidate_id"]
    perfect = CandidateScore(
        garment_fidelity=5,
        body_fidelity=5,
        realism=5,
        artifact_control=5,
    )
    average = CandidateScore(
        garment_fidelity=3,
        body_fidelity=3,
        realism=3,
        artifact_control=3,
    )
    for pair in run["pairs"]:
        favored_is_left = pair["left"] == favored
        winner = "LEFT" if favored_is_left else "RIGHT" if pair["right"] == favored else "TIE"
        service.vote(
            created["run_id"],
            pair["pair_id"],
            VoteRequest(
                evaluator_id="tester",
                winner=winner,
                left_scores=perfect if favored_is_left else average,
                right_scores=perfect if pair["right"] == favored else average,
            ),
        )

    result = service.reveal(created["run_id"])
    assert result["best"]["candidate_id"] == favored
    assert len(result["ranking"]) == 7
    assert result["team_summary"]["evaluator_count"] == 1
    assert result["team_summary"]["completed_evaluator_count"] == 1
    assert result["team_summary"]["completion_rate"] == 100
    assert result["best"]["quality_dimensions"]["garment_fidelity"] > 0


def test_dashboard_requires_completed_real_run_and_aggregates_votes(tmp_path) -> None:
    service = EvaluationService(Settings(demo_data_dir=tmp_path))
    avatar = image_bytes("white")
    garment = image_bytes("black")
    metadata = [GarmentMetadata(slot="TOP", caption="black tee")]
    created = service.create_run(
        scenario_name="real dashboard case",
        avatar=avatar,
        garments=[garment],
        metadata=metadata,
        mock_mode=True,
    )
    asyncio.run(service.process_run(created["run_id"], avatar, [garment], metadata))
    run = service.store.get(created["run_id"])
    run["mock_mode"] = False
    service.store.save(created["run_id"], run)

    with pytest.raises(PermissionError):
        service.dashboard("tester")

    perfect = CandidateScore(
        garment_fidelity=5,
        body_fidelity=5,
        realism=5,
        artifact_control=5,
    )
    for pair in run["pairs"]:
        service.vote(
            created["run_id"],
            pair["pair_id"],
            VoteRequest(
                evaluator_id="tester",
                winner="LEFT",
                left_scores=perfect,
                right_scores=perfect,
            ),
        )

    dashboard = service.dashboard("tester")

    assert dashboard["completed_real_run_count"] == 1
    assert dashboard["real_run_count"] == 1
    assert dashboard["evaluated_run_count"] == 1
    assert dashboard["total_team_votes"] == len(run["pairs"])
    assert dashboard["runs"][0]["evaluator_completed"] is True
    assert dashboard["ranking"][0]["case_count"] == 1
    assert dashboard["operations"]["real_run_count"] == 1


def test_dashboard_does_not_accept_completed_mock_run(tmp_path) -> None:
    service = EvaluationService(Settings(demo_data_dir=tmp_path))
    avatar = image_bytes("white")
    garment = image_bytes("black")
    metadata = [GarmentMetadata(slot="TOP", caption="black tee")]
    created = service.create_run(
        scenario_name="mock only",
        avatar=avatar,
        garments=[garment],
        metadata=metadata,
        mock_mode=True,
    )
    asyncio.run(service.process_run(created["run_id"], avatar, [garment], metadata))
    run = service.store.get(created["run_id"])
    score = CandidateScore(
        garment_fidelity=3,
        body_fidelity=3,
        realism=3,
        artifact_control=3,
    )
    for pair in run["pairs"]:
        service.vote(
            created["run_id"],
            pair["pair_id"],
            VoteRequest(
                evaluator_id="tester",
                winner="TIE",
                left_scores=score,
                right_scores=score,
            ),
        )

    with pytest.raises(PermissionError):
        service.dashboard("tester")


def test_pairing_is_deterministic_and_balanced() -> None:
    candidates = ["a", "b", "c", "d"]
    first = create_pairings(candidates, "seed")
    second = create_pairings(candidates, "seed")
    assert first == second
    assert len(first) == 6
    assert {frozenset((pair["left"], pair["right"])) for pair in first} == {
        frozenset(pair) for pair in (("a", "b"), ("a", "c"), ("a", "d"), ("b", "c"), ("b", "d"), ("c", "d"))
    }


def test_mai_reference_sheet_stays_within_single_reference_limit() -> None:
    sheet = make_reference_sheet(
        image_bytes("white"),
        [image_bytes("navy"), image_bytes("black"), image_bytes("gray")],
    )
    with Image.open(BytesIO(sheet)) as image:
        assert image.size == (768, 1152)
        assert image.width * image.height <= 1_048_576


def test_commercial_providers_share_openrouter_image_endpoint() -> None:
    settings = Settings(openrouter_api_key="test-key")
    providers = commercial_providers(settings)

    assert {provider.endpoint for provider in providers} == {
        "https://openrouter.ai/api/v1/images"
    }
    assert [provider.configured for provider in providers] == [
        True,
        True,
        True,
        True,
        True,
        True,
        True,
    ]


def test_openrouter_payload_uses_data_url_references() -> None:
    settings = Settings(openrouter_api_key="test-key")
    direct, lite, gpt, grok, krea, flux_max, mai = commercial_providers(settings)
    avatar = ImageInput("avatar.png", image_bytes("white"))
    garment = ImageInput("garment.png", image_bytes("navy"))
    metadata = [GarmentMetadata(slot="TOP", caption="navy cotton shirt")]

    direct_payload = direct._request_payload(avatar, [garment], metadata)
    lite_payload = lite._request_payload(avatar, [garment], metadata)
    gpt_payload = gpt._request_payload(avatar, [garment], metadata)
    grok_payload = grok._request_payload(avatar, [garment], metadata)
    krea_payload = krea._request_payload(avatar, [garment], metadata)
    flux_payload = flux_max._request_payload(avatar, [garment], metadata)
    mai_payload = mai._request_payload(avatar, [garment], metadata)

    assert direct_payload["model"] == "google/gemini-3.1-flash-image"
    assert len(direct_payload["input_references"]) == 2
    assert len(lite_payload["input_references"]) == 2
    assert "aspect_ratio" not in gpt_payload
    assert len(grok_payload["input_references"]) == 2
    assert len(krea_payload["input_references"]) == 1
    assert "n" not in krea_payload
    assert len(flux_payload["input_references"]) == 2
    assert "aspect_ratio" not in flux_payload
    assert len(mai_payload["input_references"]) == 1
    assert direct_payload["input_references"][0]["image_url"]["url"].startswith(
        "data:image/png;base64,"
    )


def test_grok_switches_to_reference_sheet_above_three_inputs() -> None:
    settings = Settings(openrouter_api_key="test-key")
    grok = commercial_providers(settings)[3]
    avatar = ImageInput("avatar.png", image_bytes("white"))
    garments = [
        ImageInput(f"garment-{index}.png", image_bytes(color))
        for index, color in enumerate(("navy", "black", "gray"), start=1)
    ]
    metadata = [
        GarmentMetadata(slot=slot, caption=f"{slot.lower()} garment")
        for slot in ("TOP", "BOTTOM", "OUTER")
    ]

    payload = grok._request_payload(avatar, garments, metadata)

    assert len(payload["input_references"]) == 1
    assert "reference sheet" in payload["prompt"].lower()


def test_openrouter_metrics_prefers_response_usage_cost() -> None:
    metrics = _openrouter_metrics(
        {
            "usage": {
                "cost": 0.03125,
                "prompt_tokens": 100,
                "completion_tokens": 200,
                "total_tokens": 300,
            }
        },
        {
            "total_cost": 0.04,
            "generation_time": 1234,
            "latency": 1300,
            "provider_name": "Example Provider",
        },
        "gen-test",
    )

    assert metrics["cost_usd"] == 0.03125
    assert metrics["generation_time_ms"] == 1234
    assert metrics["gateway_latency_ms"] == 1300
    assert metrics["total_tokens"] == 300


def test_provider_error_classification_distinguishes_rate_limit_and_skip(tmp_path) -> None:
    service = EvaluationService(Settings(demo_data_dir=tmp_path))
    request = httpx.Request("POST", "https://openrouter.ai/api/v1/images")
    response = httpx.Response(
        429,
        request=request,
        headers={"Retry-After": "12"},
        json={
            "error": {
                "message": "Rate limit exceeded",
                "metadata": {"error_type": "rate_limit_exceeded"},
            }
        },
    )
    rate_limit = service._classify_provider_error(
        httpx.HTTPStatusError("rate limited", request=request, response=response)
    )
    skipped = service._classify_provider_error(
        ProviderUnavailable("missing model", category="UNSUPPORTED_MODEL")
    )

    assert rate_limit["error_category"] == "RATE_LIMIT"
    assert rate_limit["retryable"] is True
    assert rate_limit["retry_after_seconds"] == 12
    assert skipped["status"] == "SKIPPED"
    assert skipped["external_request_made"] is False


def test_operations_summary_aggregates_real_runs_only() -> None:
    catalog = [
        {
            "provider_id": "model_a",
            "display_name": "Model A",
            "model": "vendor/model-a",
            "input_strategy": "multi-reference",
            "is_fallback": False,
        }
    ]
    attempts = [
        {
            "provider_id": "model_a",
            "status": "SUCCEEDED",
            "external_request_made": True,
            "latency_ms": 1000,
            "generation_time_ms": 800,
            "cost_usd": 0.02,
            "checked_at": "2026-07-22T01:00:00+00:00",
        },
        {
            "provider_id": "model_a",
            "status": "SUCCEEDED",
            "external_request_made": True,
            "latency_ms": 2000,
            "generation_time_ms": 1600,
            "cost_usd": 0.04,
            "checked_at": "2026-07-22T01:01:00+00:00",
        },
        {
            "provider_id": "model_a",
            "status": "FAILED",
            "external_request_made": True,
            "latency_ms": 500,
            "error_category": "RATE_LIMIT",
            "checked_at": "2026-07-22T01:02:00+00:00",
        },
    ]
    summary = operations_summary(
        [
            {"mock_mode": False, "provider_attempts": attempts},
            {"mock_mode": True, "provider_attempts": attempts},
        ],
        catalog,
    )
    provider = summary["providers"][0]

    assert summary["real_run_count"] == 1
    assert provider["actual_call_count"] == 3
    assert provider["success_rate"] == 66.7
    assert provider["latency"]["median_ms"] == 1500
    assert provider["cost"]["total_usd"] == 0.06
    assert provider["error_categories"] == {"RATE_LIMIT": 1}
    assert percentile([1000, 2000], 0.95) == 1950


def test_musinsa_demo_dataset_has_six_valid_top_bottom_cases() -> None:
    settings = Settings()
    manifest_path = settings.demo_test_data_dir / "musinsa" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    assert manifest["source"] == "MUSINSA"
    assert len(manifest["cases"]) == 6
    for case in manifest["cases"]:
        assert [item["slot"] for item in case["garments"]] == ["TOP", "BOTTOM"]
        for garment in case["garments"]:
            assert 2 <= len(garment["fit_tags"]) <= 3
            assert "\n" not in garment["caption"]
            image_path = settings.demo_test_data_dir / garment["image_url"].removeprefix(
                "/test-data/"
            )
            assert image_path.is_file()
            with Image.open(image_path) as image:
                assert image.width == 1200


def test_round_two_musinsa_dataset_has_single_and_outfit_presets() -> None:
    settings = Settings()
    manifest_path = (
        settings.demo_test_data_dir / "musinsa" / "round2-manifest.json"
    )
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    assert manifest["source"] == "MUSINSA"
    assert manifest["rights_status"] == "internal-evaluation-only-unverified"
    assert len(manifest["cases"]) == 6
    assert len({case["id"] for case in manifest["cases"]}) == 6
    assert [case["axis"] for case in manifest["cases"]].count(
        "SIZE_SENSITIVITY"
    ) == 4
    assert [case["axis"] for case in manifest["cases"]].count(
        "REFERENCE_CONTAMINATION"
    ) == 2
    assert len(manifest["outfit_cases"]) == 6
    assert len({case["id"] for case in manifest["outfit_cases"]}) == 6
    assert all(
        case["axis"] == "OUTFIT_COMBINATION"
        for case in manifest["outfit_cases"]
    )
    assert [case["avatar"]["gender"] for case in manifest["outfit_cases"]].count(
        "FEMALE"
    ) == 3
    assert [case["avatar"]["gender"] for case in manifest["outfit_cases"]].count(
        "MALE"
    ) == 3

    all_cases = [
        *((case, [case["garment"]]) for case in manifest["cases"]),
        *((case, case["garments"]) for case in manifest["outfit_cases"]),
    ]
    for case, garments in all_cases:
        AvatarInput.model_validate(case["avatar"])
        if case["axis"] == "OUTFIT_COMBINATION":
            assert [garment["slot"] for garment in garments] == ["TOP", "BOTTOM"]
        for garment in garments:
            GarmentMetadata.model_validate(
                {
                    "slot": garment["slot"],
                    "caption": garment["caption"],
                    "reference_type": garment["reference_type"],
                    "selected_size": garment["selected_size"],
                    "measurements": garment["measurements"],
                }
            )
            image_path = settings.demo_test_data_dir / garment[
                "image_url"
            ].removeprefix("/test-data/")
            assert image_path.is_file()
            assert hashlib.sha256(image_path.read_bytes()).hexdigest() == garment[
                "image_sha256"
            ]
            with Image.open(image_path) as image:
                assert image.width >= 500
                assert image.height >= 500


def round_two_avatar() -> AvatarProfile:
    return AvatarProfile(
        preset_id="female-hourglass",
        label="여성 · 모래시계형",
        gender="FEMALE",
        body_type="HOURGLASS",
        body_build="STANDARD",
        height_cm=165,
        weight_kg=54,
        shoulder_width_cm=38,
        chest_circumference_cm=86,
        waist_circumference_cm=68,
        hip_circumference_cm=94,
        arm_length_cm=56,
        inseam_cm=76,
    )


def round_two_top(size: str = "M", chest_width_cm: float = 51) -> GarmentMetadata:
    return GarmentMetadata(
        slot="TOP",
        category="T_SHIRT",
        caption="black logo cotton tee",
        reference_type="worn-reference",
        selected_size=size,
        measurements=GarmentMeasurements(
            total_length_cm=64,
            shoulder_width_cm=42,
            chest_width_cm=chest_width_cm,
            sleeve_length_cm=57,
        ),
    )


def test_round_two_profile_accepts_numeric_alias_and_has_exact_four_models() -> None:
    settings = Settings(openrouter_api_key="test-key")
    providers = commercial_providers(settings, normalize_evaluation_round("2"))

    assert tuple(provider.provider_id for provider in providers) == ROUND_2_PROVIDER_IDS
    assert all(
        provider.input_strategy == "role-labeled-multi-reference"
        for provider in providers
    )
    assert "flux_klein_9b_lora" not in {
        provider.provider_id for provider in providers
    }


def test_selected_size_measurements_change_server_derived_fit() -> None:
    avatar = round_two_avatar()
    fitted = derive_fit_assessment(round_two_top("S", 44), avatar)
    oversized = derive_fit_assessment(round_two_top("XL", 60), avatar)

    assert fitted.rule_version == FIT_RULE_VERSION
    assert fitted.overall_fit == "FITTED"
    assert oversized.overall_fit == "OVERSIZED"
    assert fitted.measurement_deltas_cm["chest_ease"] == 2
    assert oversized.measurement_deltas_cm["chest_ease"] == 34


def test_sleeve_tag_uses_api_spec_beyond_wrist_enum() -> None:
    avatar = round_two_avatar()
    garment = round_two_top().model_copy(
        update={
            "measurements": round_two_top().measurements.model_copy(
                update={"sleeve_length_cm": 62}
            )
        }
    )

    assert derive_fit_assessment(garment, avatar).sleeve == "BEYOND_WRIST"


def test_bottom_total_length_is_used_when_inseam_is_missing() -> None:
    avatar = round_two_avatar()
    ankle = GarmentMetadata(
        slot="BOTTOM",
        caption="straight trousers",
        selected_size="M",
        measurements=GarmentMeasurements(
            total_length_cm=90,
            waist_width_cm=36,
            hip_width_cm=50,
            thigh_width_cm=30,
            rise_cm=29,
            hem_width_cm=22,
        ),
    )
    long = ankle.model_copy(
        update={
            "selected_size": "L",
            "measurements": ankle.measurements.model_copy(
                update={"total_length_cm": 106}
            ),
        }
    )

    ankle_fit = derive_fit_assessment(ankle, avatar)
    assert ankle_fit.length == "ANKLE"
    assert ankle_fit.rise == "HIGH_RISE"
    assert ankle_fit.leg_shape == "STRAIGHT"
    assert derive_fit_assessment(long, avatar).length == "LONG"


def test_round_two_prompt_locks_avatar_and_ignores_garment_wearer() -> None:
    avatar = round_two_avatar()
    garment = round_two_top()
    garment = garment.model_copy(
        update={"fit_assessment": derive_fit_assessment(garment, avatar)}
    )

    prompt = build_round_two_prompt([garment], avatar)

    assert "sole identity" in prompt
    assert "Ignore that wearer completely" in prompt
    assert "Reference 1 wins" in prompt
    assert "Selected size: M" in prompt
    assert "overall:RELAXED" in prompt
    assert "weight=54kg" in prompt
    assert "weight=54cm" not in prompt


def test_round_two_payload_visually_labels_each_reference() -> None:
    provider = commercial_providers(
        Settings(openrouter_api_key="test-key"),
        "ROUND_2",
    )[0]
    avatar = round_two_avatar()
    garment = round_two_top()
    garment = garment.model_copy(
        update={"fit_assessment": derive_fit_assessment(garment, avatar)}
    )

    payload = provider._request_payload(
        ImageInput("avatar.png", image_bytes("white")),
        [ImageInput("garment.png", image_bytes("navy"))],
        [garment],
        avatar,
    )

    assert len(payload["input_references"]) == 2
    encoded = payload["input_references"][0]["image_url"]["url"].split(",", 1)[1]
    with Image.open(BytesIO(__import__("base64").b64decode(encoded))) as labeled:
        assert labeled.width >= 768
        assert labeled.height == 180 + 112
    assert "GARMENT ONLY" in payload["prompt"]


def test_round_two_mock_run_persists_profile_fit_and_six_pairs(tmp_path) -> None:
    service = EvaluationService(Settings(demo_data_dir=tmp_path))
    avatar_bytes = image_bytes("white")
    garment_bytes = image_bytes("navy")
    avatar = round_two_avatar()
    metadata = [round_two_top()]
    created = service.create_run(
        scenario_name="round 2 fit-aware",
        avatar=avatar_bytes,
        garments=[garment_bytes],
        metadata=metadata,
        mock_mode=True,
        evaluation_round="ROUND_2",
        avatar_profile=avatar,
    )

    asyncio.run(
        service.process_run(
            created["run_id"],
            avatar_bytes,
            [garment_bytes],
            metadata,
            avatar,
        )
    )
    stored = service.store.get(created["run_id"])
    public = service.public_run(created["run_id"], "tester")
    garment_reference = public["references"]["garments"][0]

    assert stored["evaluation_round"] == 2
    assert stored["evaluation_profile"] == "round-2-fit-aware"
    assert stored["prompt_version"] == "canonical-v2-fit-aware"
    assert stored["fit_rule_version"] == FIT_RULE_VERSION
    assert stored["expected_provider_ids"] == list(ROUND_2_PROVIDER_IDS)
    assert stored["missing_provider_ids"] == []
    assert public["candidate_count"] == 4
    assert public["pair_count"] == 6
    assert garment_reference["selected_size"] == "M"
    assert garment_reference["reference_type"] == "worn-reference"
    assert garment_reference["fit_assessment"]["overall_fit"] == "RELAXED"


def test_round_two_real_run_never_uses_local_fallback(tmp_path) -> None:
    service = EvaluationService(
        Settings(demo_data_dir=tmp_path, openrouter_api_key="")
    )
    avatar_bytes = image_bytes("white")
    garment_bytes = image_bytes("navy")
    avatar = round_two_avatar()
    metadata = [round_two_top()]
    created = service.create_run(
        scenario_name="round 2 provider failure",
        avatar=avatar_bytes,
        garments=[garment_bytes],
        metadata=metadata,
        mock_mode=False,
        evaluation_round="ROUND_2",
        avatar_profile=avatar,
    )

    asyncio.run(
        service.process_run(
            created["run_id"],
            avatar_bytes,
            [garment_bytes],
            metadata,
            avatar,
        )
    )
    stored = service.store.get(created["run_id"])

    assert stored["status"] == "INSUFFICIENT_RESULTS"
    assert len(stored["provider_attempts"]) == 4
    assert {
        attempt["provider_id"] for attempt in stored["provider_attempts"]
    } == set(ROUND_2_PROVIDER_IDS)
    assert "flux_klein_9b_lora" not in {
        attempt["provider_id"] for attempt in stored["provider_attempts"]
    }


def test_round_two_preflight_skips_all_billable_calls_when_one_model_is_missing(
    tmp_path,
    monkeypatch,
) -> None:
    service = EvaluationService(
        Settings(
            demo_data_dir=tmp_path,
            openrouter_api_key="test-key",
            openrouter_flux_max_model="",
        )
    )

    async def fail_if_called(*args, **kwargs):
        raise AssertionError("commercial calls must not start after failed preflight")

    monkeypatch.setattr(service, "_run_commercial", fail_if_called)
    avatar_bytes = image_bytes("white")
    garment_bytes = image_bytes("navy")
    avatar = round_two_avatar()
    metadata = [round_two_top()]
    created = service.create_run(
        scenario_name="round 2 preflight",
        avatar=avatar_bytes,
        garments=[garment_bytes],
        metadata=metadata,
        mock_mode=False,
        evaluation_round="ROUND_2",
        avatar_profile=avatar,
    )

    asyncio.run(
        service.process_run(
            created["run_id"],
            avatar_bytes,
            [garment_bytes],
            metadata,
            avatar,
        )
    )
    stored = service.store.get(created["run_id"])

    assert stored["status"] == "INSUFFICIENT_RESULTS"
    assert all(
        not attempt["external_request_made"]
        for attempt in stored["provider_attempts"]
    )
    assert {
        attempt["error_category"] for attempt in stored["provider_attempts"]
    } == {"INCOMPLETE_PROVIDER_SET", "NOT_CONFIGURED"}


def test_round_two_route_rejects_empty_selected_size_measurements() -> None:
    async def submit_invalid_run() -> httpx.Response:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            return await client.post(
                "/api/v1/evaluation/runs",
                data={
                    "scenario_name": "invalid round 2 measurements",
                    "mock_mode": "true",
                    "evaluation_round": "2",
                    "avatar_profile": json.dumps(
                        {
                            "preset_id": "female-rectangle",
                            "gender": "FEMALE",
                            "height_cm": 162,
                            "weight_kg": 54,
                        }
                    ),
                    "garment_metadata": json.dumps(
                        [
                            {
                                "slot": "TOP",
                                "caption": "navy shirt",
                                "reference_type": "product-only",
                                "selected_size": "M",
                                "measurements": {},
                            }
                        ]
                    ),
                },
                files=[
                    ("avatar", ("avatar.png", image_bytes("white"), "image/png")),
                    (
                        "garments",
                        ("garment.png", image_bytes("navy"), "image/png"),
                    ),
                ],
            )

    response = asyncio.run(submit_invalid_run())

    assert response.status_code == 422
    assert "shoulder_width_cm" in response.json()["detail"]
    assert "chest_width_cm" in response.json()["detail"]
    assert "total_length_cm" in response.json()["detail"]


def test_dashboard_filters_round_one_and_round_two_runs(tmp_path) -> None:
    service = EvaluationService(Settings(demo_data_dir=tmp_path))
    avatar_bytes = image_bytes("white")
    garment_bytes = image_bytes("navy")
    avatar = round_two_avatar()
    score = CandidateScore(
        garment_fidelity=4,
        body_fidelity=4,
        realism=4,
        artifact_control=4,
    )
    created_runs = []
    for evaluation_round, metadata, profile in (
        ("ROUND_1", [GarmentMetadata(slot="TOP", caption="navy tee")], None),
        ("ROUND_2", [round_two_top()], avatar),
    ):
        created = service.create_run(
            scenario_name=f"{evaluation_round} dashboard",
            avatar=avatar_bytes,
            garments=[garment_bytes],
            metadata=metadata,
            mock_mode=True,
            evaluation_round=evaluation_round,
            avatar_profile=profile,
        )
        asyncio.run(
            service.process_run(
                created["run_id"],
                avatar_bytes,
                [garment_bytes],
                metadata,
                profile,
            )
        )
        stored = service.store.get(created["run_id"])
        stored["mock_mode"] = False
        service.store.save(created["run_id"], stored)
        for pair in stored["pairs"]:
            service.vote(
                created["run_id"],
                pair["pair_id"],
                VoteRequest(
                    evaluator_id="round-filter-tester",
                    winner="TIE",
                    left_scores=score,
                    right_scores=score,
                ),
            )
        created_runs.append(created["run_id"])

    round_one = service.dashboard("round-filter-tester", "ROUND_1")
    round_two = service.dashboard("round-filter-tester", "ROUND_2")

    assert round_one["evaluation_round"] == 1
    assert round_two["evaluation_round"] == 2
    assert [item["run_id"] for item in round_one["runs"]] == [created_runs[0]]
    assert [item["run_id"] for item in round_two["runs"]] == [created_runs[1]]
    assert {item["provider_id"] for item in round_two["ranking"]} == set(
        ROUND_2_PROVIDER_IDS
    )
