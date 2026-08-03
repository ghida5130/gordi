"""Internal try-on job intake (Spring contract) and result serving."""

from __future__ import annotations

import logging
import re
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import FileResponse, Response

from app.core.config import Settings, get_settings
from app.core.security import verify_internal_token
from app.schemas.tryon import TryOnGenerationRequest
from app.services.tryon_jobs import (
    TryOnJobProcessor,
    build_processor,
    job_registry,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/try-on-jobs",
    dependencies=[Depends(verify_internal_token)],
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
) -> Response:
    if not job_registry.try_accept(request.job_id):
        # Job 하나당 접수는 한 번 — 중복 접수는 성공으로 응답만 한다.
        logger.info("duplicate try-on submit job_id=%s", request.job_id)
        return Response(status_code=status.HTTP_202_ACCEPTED)
    background.add_task(processor.process, request)
    return Response(status_code=status.HTTP_202_ACCEPTED)


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
