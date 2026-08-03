"""Internal try-on job intake (Spring contract) and result serving."""

from __future__ import annotations

import logging
import re
from pathlib import Path

from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import FileResponse

from app.core.config import Settings, get_settings
from app.core.security import verify_internal_api_key
from app.schemas.tryon import TryOnGenerationRequest
from app.services.tryon_jobs import (
    PROMPT_VERSION,
    TryOnJobProcessor,
    build_processor,
    job_registry,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/try-on-jobs",
    dependencies=[Depends(verify_internal_api_key)],
)
results_router = APIRouter(prefix="/try-on-results")

_RESULT_FILENAME = re.compile(r"^job-\d+\.(png|jpg)$")


def get_tryon_processor() -> TryOnJobProcessor:
    return build_processor()


@router.post(
    "",
    status_code=status.HTTP_202_ACCEPTED,
    summary="착장 생성 Job 접수 (Spring 내부 계약)",
)
async def submit_try_on_job(
    request: TryOnGenerationRequest,
    background: BackgroundTasks,
    processor: TryOnJobProcessor = Depends(get_tryon_processor),
) -> dict[str, Any]:
    if job_registry.try_accept(request.job_id):
        background.add_task(processor.process, request)
        job_status = "QUEUED"
    else:
        # Job 하나당 접수는 한 번 — 중복 접수는 성공으로 응답만 한다.
        logger.info("duplicate try-on submit job_id=%s", request.job_id)
        record = job_registry.get(request.job_id)
        job_status = record.status if record else "QUEUED"
    return {
        "data": {
            "jobId": request.job_id,
            "status": job_status,
            "cacheHit": False,
        }
    }


@router.get(
    "/{job_id}",
    summary="착장 Job 상태 조회 (Spring 정합 복구 worker 전용)",
)
def get_try_on_job(job_id: int) -> dict[str, Any]:
    record = job_registry.get(job_id)
    if record is None:
        # 재시작 등으로 잊힌 Job — Spring 이 "AI 가 모르는 Job" 으로 마감한다.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="unknown try-on job",
        )
    return {
        "data": {
            "jobId": record.job_id,
            "status": record.status,
            "attempt": record.attempt,
            "cacheHit": record.cache_hit,
            "result": record.result,
            "error": record.error,
            "modelVersion": record.model_version,
            "promptVersion": PROMPT_VERSION,
            "createdAt": record.created_at,
            "completedAt": record.completed_at,
        }
    }


@results_router.get(
    "/{filename}",
    include_in_schema=False,
)
def get_try_on_result(
    filename: str,
    settings: Settings = Depends(get_settings),
) -> FileResponse:
    if _RESULT_FILENAME.match(filename) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid result filename",
        )
    path = (Path(settings.tryon_result_dir) / filename).resolve()
    try:
        path.relative_to(Path(settings.tryon_result_dir).resolve())
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid result path",
        ) from exc
    if not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="result not found",
        )
    return FileResponse(path)
