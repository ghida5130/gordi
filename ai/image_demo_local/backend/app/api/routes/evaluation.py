from __future__ import annotations

import json
from functools import lru_cache

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)

from app.core.config import get_settings
from app.evaluation.avatar_presets import resolve_avatar_profile
from app.evaluation.images import ALLOWED_MIME_TYPES, normalize_image
from app.evaluation.models import AvatarInput, AvatarProfile, GarmentMetadata, VoteRequest
from app.evaluation.profiles import normalize_evaluation_round
from app.evaluation.service import EvaluationService

router = APIRouter()


@lru_cache
def get_service() -> EvaluationService:
    return EvaluationService(get_settings())


async def _read_image(upload: UploadFile, *, label: str) -> bytes:
    settings = get_settings()
    if upload.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"{label} must be PNG, JPEG, or WebP",
        )
    data = await upload.read(settings.demo_max_upload_mb * 1024 * 1024 + 1)
    if len(data) > settings.demo_max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"{label} exceeds upload limit")
    try:
        return normalize_image(data)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"{label} is not a valid image") from exc


@router.get("/setup", summary="블라인드 데모 공급자 설정 상태")
async def provider_setup(
    evaluation_round: str = Query(default="ROUND_1"),
) -> dict:
    try:
        normalized_round = normalize_evaluation_round(evaluation_round)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return get_service().provider_setup(normalized_round)


@router.get("/operations", summary="실제 호출 운영 지표 통합 조회")
async def operational_summary(
    evaluation_round: str = Query(default="ROUND_1"),
) -> dict:
    try:
        normalized_round = normalize_evaluation_round(evaluation_round)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return get_service().operational_summary(normalized_round)


@router.get("/dashboard", summary="실제 실행 통합 평가 대시보드")
async def integrated_dashboard(
    evaluator_id: str = Query(min_length=1, max_length=80),
    evaluation_round: str = Query(default="ROUND_1"),
) -> dict:
    try:
        normalized_round = normalize_evaluation_round(evaluation_round)
        return get_service().dashboard(evaluator_id.strip(), normalized_round)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.post("/runs", status_code=status.HTTP_202_ACCEPTED, summary="A/B 평가 실행 생성")
async def create_run(
    background_tasks: BackgroundTasks,
    scenario_name: str = Form(min_length=1, max_length=120),
    garment_metadata: str = Form(),
    mock_mode: bool = Form(False),
    evaluation_round: str = Form("ROUND_1"),
    avatar_profile: str | None = Form(default=None),
    avatar: UploadFile = File(),
    garments: list[UploadFile] = File(),
) -> dict:
    if not 1 <= len(garments) <= 3:
        raise HTTPException(status_code=422, detail="Upload between 1 and 3 garments")
    try:
        metadata_json = json.loads(garment_metadata)
        metadata = [GarmentMetadata.model_validate(item) for item in metadata_json]
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Invalid garment_metadata JSON") from exc
    if len(metadata) != len(garments):
        raise HTTPException(status_code=422, detail="Garment files and metadata must match")
    slots = [item.slot for item in metadata]
    if len(slots) != len(set(slots)):
        raise HTTPException(status_code=422, detail="Garment slots must be unique")
    if "DRESS" in slots and any(slot in slots for slot in ("TOP", "BOTTOM")):
        raise HTTPException(status_code=422, detail="DRESS cannot be combined with TOP or BOTTOM")
    try:
        normalized_round = normalize_evaluation_round(evaluation_round)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    parsed_avatar_profile: AvatarProfile | None = None
    if avatar_profile:
        try:
            avatar_payload = json.loads(avatar_profile)
            if normalized_round == "ROUND_2":
                parsed_avatar_profile = resolve_avatar_profile(
                    AvatarInput.model_validate(avatar_payload)
                )
            else:
                parsed_avatar_profile = AvatarProfile.model_validate(avatar_payload)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=422,
                detail="Invalid avatar_profile JSON",
            ) from exc
    if normalized_round == "ROUND_2":
        if parsed_avatar_profile is None:
            raise HTTPException(
                status_code=422,
                detail="avatar_profile is required for Round 2",
            )
        required_measurements = {
            "TOP": ("shoulder_width_cm", "chest_width_cm", "total_length_cm"),
            "OUTER": ("shoulder_width_cm", "chest_width_cm", "total_length_cm"),
            "BOTTOM": ("total_length_cm", "waist_width_cm", "hip_width_cm"),
            "DRESS": (
                "chest_width_cm",
                "waist_width_cm",
                "hip_width_cm",
                "total_length_cm",
            ),
        }
        for index, item in enumerate(metadata, start=1):
            if not item.selected_size or item.measurements is None:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Round 2 garment {index} requires selected_size and "
                        "selected-size measurements"
                    ),
                )
            missing_fields = [
                field
                for field in required_measurements[item.slot]
                if getattr(item.measurements, field) is None
            ]
            if missing_fields:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Round 2 garment {index} is missing required measurements: "
                        f"{', '.join(missing_fields)}"
                    ),
                )

    avatar_bytes = await _read_image(avatar, label="avatar")
    garment_bytes = [
        await _read_image(upload, label=f"garment {index + 1}")
        for index, upload in enumerate(garments)
    ]
    service = get_service()
    run = service.create_run(
        scenario_name=scenario_name,
        avatar=avatar_bytes,
        garments=garment_bytes,
        metadata=metadata,
        mock_mode=mock_mode,
        evaluation_round=normalized_round,
        avatar_profile=parsed_avatar_profile,
    )
    background_tasks.add_task(
        service.process_run,
        run["run_id"],
        avatar_bytes,
        garment_bytes,
        metadata,
        parsed_avatar_profile,
    )
    return {
        "run_id": run["run_id"],
        "status": run["status"],
        "evaluation_round": run["evaluation_round"],
        "evaluation_profile": run["evaluation_profile"],
        "prompt_version": run["prompt_version"],
    }


@router.get("/runs/{run_id}", summary="블라인드 평가 실행 조회")
async def get_run(
    run_id: str,
    evaluator_id: str | None = Query(default=None, max_length=80),
) -> dict:
    try:
        return get_service().public_run(run_id, evaluator_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Evaluation run not found") from exc


@router.put("/runs/{run_id}/pairs/{pair_id}/vote", summary="블라인드 A/B 평가 저장")
async def save_vote(run_id: str, pair_id: str, vote: VoteRequest) -> dict:
    try:
        return get_service().vote(run_id, pair_id, vote)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Run or pair not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/runs/{run_id}/reveal", summary="모델 매핑과 집계 결과 공개")
async def reveal_run(run_id: str) -> dict:
    try:
        return get_service().reveal(run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Evaluation run not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
