"""Local-only FastAPI page and upload API for pipeline inspection."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Any

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import HTMLResponse
from fastapi.responses import FileResponse, StreamingResponse
from starlette.concurrency import run_in_threadpool

from app.api.dependencies import (
    require_recommendation_demo,
    require_recommendation_pipeline,
)
from app.core.config import Settings, get_settings
from app.recommendation.catalog_embeddings import (
    MAX_IMAGE_BYTES,
    CatalogEmbeddingError,
    detect_image_mime,
)
from app.recommendation.pipeline import (
    RecommendationPipeline,
    RecommendationPipelineError,
)
from app.recommendation.vector_index import SearchFilters, VectorIndexError
from app.recommendation.tpo_eval import (
    TpoEvalError,
    TpoJudgment,
    append_judgments,
    load_judgments,
    load_tpo_queries,
    summarize_judgments,
)
from app.schemas.recommendation import (
    DemoRecommendationResponse,
    DemoRecommendedProduct,
    TpoJudgmentSaveResponse,
    TpoJudgmentSubmission,
    TpoQueriesResponse,
    TpoQueryItem,
)

_DEMO_HTML_PATH = (
    Path(__file__).resolve().parents[2]
    / "static"
    / "recommendation_demo.html"
)
_TPO_EVAL_HTML_PATH = (
    Path(__file__).resolve().parents[2]
    / "static"
    / "tpo_eval_demo.html"
)

page_router = APIRouter(
    prefix="/demo",
    dependencies=[Depends(require_recommendation_demo)],
)
api_router = APIRouter(
    prefix="/demo/recommendations",
    dependencies=[Depends(require_recommendation_demo)],
)
tpo_api_router = APIRouter(
    prefix="/demo/tpo-eval",
    dependencies=[Depends(require_recommendation_demo)],
)


@page_router.get(
    "/recommendations",
    response_class=HTMLResponse,
    include_in_schema=False,
)
def recommendation_demo_page() -> HTMLResponse:
    try:
        html = _DEMO_HTML_PATH.read_text(encoding="utf-8")
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"demo asset unavailable: {exc}",
        ) from exc
    return HTMLResponse(html)


def _dataset_primary_image(
    source: str,
    external_id: str,
    settings: Settings,
) -> Path:
    dataset_root = settings.recommendation_demo_dataset_root
    if dataset_root is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )
    root = dataset_root.resolve()
    product_dir = (
        root / "images" / source.casefold() / external_id
    ).resolve()
    try:
        product_dir.relative_to(root)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid catalog image path",
        ) from exc
    matches = sorted(
        path.resolve()
        for path in product_dir.glob("primary.*")
        if path.is_file()
    )
    if len(matches) != 1:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="catalog image not found",
        )
    try:
        matches[0].relative_to(root)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid catalog image path",
        ) from exc
    return matches[0]


@page_router.get(
    "/catalog-images/{source}/{external_id}",
    response_class=FileResponse,
    include_in_schema=False,
)
def recommendation_demo_catalog_image(
    source: str,
    external_id: str,
    settings: Settings = Depends(get_settings),
) -> FileResponse:
    return FileResponse(
        _dataset_primary_image(source, external_id, settings)
    )


@page_router.get(
    "/catalog-images-by-key/garments/{source}/{external_id}/{file_name}",
    response_class=FileResponse,
    include_in_schema=False,
)
def recommendation_demo_catalog_image_by_key(
    source: str,
    external_id: str,
    file_name: str,
    settings: Settings = Depends(get_settings),
) -> FileResponse:
    """Serve the local dataset image for an S3 object-key path.

    Lets PRODUCT_IMAGE_BASE_URL point at this route so the VLM
    reranker can attach candidate images offline: the snapshot's
    stored URL keeps its S3 key path (garments/{source}/{id}/
    primary-{sha}.{ext}) and this route maps it onto the reviewed
    dataset's primary image. The sha-named file itself is not
    looked up — the dataset holds one primary per product.
    """
    if not file_name.startswith("primary"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="catalog image not found",
        )
    return FileResponse(
        _dataset_primary_image(source, external_id, settings)
    )


async def _parse_demo_request(
    *,
    text: str | None,
    image: UploadFile | None,
    gender: str,
    category: str | None,
    subcategory: str | None,
    budget_min: int,
    budget_max: int | None,
    candidate_limit: int,
    result_limit: int,
) -> dict[str, Any]:
    normalized_text = (text or "").strip() or None
    normalized_category = (category or "").strip() or None
    normalized_subcategory = (subcategory or "").strip() or None
    if budget_max is not None and budget_min > budget_max:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="budgetMin must be less than or equal to budgetMax",
        )
    if result_limit > candidate_limit:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="resultLimit must not exceed candidateLimit",
        )

    image_bytes = None
    image_mime_type = None
    if image is not None:
        try:
            image_bytes = await image.read(MAX_IMAGE_BYTES + 1)
        finally:
            await image.close()
        if len(image_bytes) > MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="image exceeds size limit",
            )
        if image_bytes:
            try:
                image_mime_type = detect_image_mime(
                    image_bytes,
                    context="query image",
                )
            except CatalogEmbeddingError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(exc),
                ) from exc
        else:
            image_bytes = None
    if normalized_text is None and image_bytes is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="text or image is required",
        )

    return {
        "text": normalized_text,
        "image": image_bytes,
        "mime_type": image_mime_type,
        "filters": SearchFilters(
            gender=gender,
            category=normalized_category,
            subcategory=normalized_subcategory,
            budget_min=budget_min,
            budget_max=budget_max,
        ),
        "candidate_limit": candidate_limit,
        "result_limit": result_limit,
    }


def _build_demo_response(
    results: list[Any],
    *,
    pipeline: RecommendationPipeline,
    settings: Settings,
    candidate_limit: int,
) -> DemoRecommendationResponse:
    return DemoRecommendationResponse(
        schema_version="1.0",
        index_version=pipeline.index_version,
        candidate_limit=candidate_limit,
        results=[
            DemoRecommendedProduct(
                product_id=result.product_id,
                rank=result.rank,
                score=round(result.score, 6),
                retrieval_score=round(result.retrieval_score, 6),
                compatibility_score=round(
                    result.compatibility_score,
                    6,
                ),
                reason=result.reason,
                name=str(result.product["name"]),
                brand=str(result.product["brand"]),
                price=int(result.product["price"]),
                currency=str(result.product["currency"]),
                category=str(result.product["category"]),
                subcategory=str(result.product["subcategory"]),
                image_url=_demo_image_url(result.product, settings),
                purchase_url=str(result.product["purchase_url"]),
            )
            for result in results
        ],
    )


@api_router.post(
    "",
    response_model=DemoRecommendationResponse,
    summary="로컬 추천 파이프라인 데모",
)
async def run_recommendation_demo(
    text: Annotated[str | None, Form(max_length=2_000)] = None,
    image: Annotated[UploadFile | None, File()] = None,
    gender: Annotated[str, Form(pattern="^(MALE|FEMALE)$")] = "MALE",
    category: Annotated[str | None, Form(max_length=100)] = None,
    subcategory: Annotated[str | None, Form(max_length=100)] = None,
    budget_min: Annotated[int, Form(ge=0)] = 0,
    budget_max: Annotated[int | None, Form(ge=0)] = None,
    candidate_limit: Annotated[int, Form(ge=1, le=200)] = 50,
    result_limit: Annotated[int, Form(ge=1, le=50)] = 10,
    pipeline: RecommendationPipeline = Depends(
        require_recommendation_pipeline
    ),
    settings: Settings = Depends(get_settings),
) -> DemoRecommendationResponse:
    request = await _parse_demo_request(
        text=text,
        image=image,
        gender=gender,
        category=category,
        subcategory=subcategory,
        budget_min=budget_min,
        budget_max=budget_max,
        candidate_limit=candidate_limit,
        result_limit=result_limit,
    )
    try:
        results = await run_in_threadpool(
            pipeline.recommend,
            **request,
        )
    except (RecommendationPipelineError, VectorIndexError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return _build_demo_response(
        results,
        pipeline=pipeline,
        settings=settings,
        candidate_limit=candidate_limit,
    )


@api_router.post(
    "/stream",
    summary="로컬 추천 파이프라인 데모 (NDJSON 진행 이벤트 스트림)",
)
async def run_recommendation_demo_stream(
    text: Annotated[str | None, Form(max_length=2_000)] = None,
    image: Annotated[UploadFile | None, File()] = None,
    gender: Annotated[str, Form(pattern="^(MALE|FEMALE)$")] = "MALE",
    category: Annotated[str | None, Form(max_length=100)] = None,
    subcategory: Annotated[str | None, Form(max_length=100)] = None,
    budget_min: Annotated[int, Form(ge=0)] = 0,
    budget_max: Annotated[int | None, Form(ge=0)] = None,
    candidate_limit: Annotated[int, Form(ge=1, le=200)] = 50,
    result_limit: Annotated[int, Form(ge=1, le=50)] = 10,
    pipeline: RecommendationPipeline = Depends(
        require_recommendation_pipeline
    ),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    request = await _parse_demo_request(
        text=text,
        image=image,
        gender=gender,
        category=category,
        subcategory=subcategory,
        budget_min=budget_min,
        budget_max=budget_max,
        candidate_limit=candidate_limit,
        result_limit=result_limit,
    )
    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def report_progress(stage: str, detail: dict[str, Any]) -> None:
        loop.call_soon_threadsafe(
            queue.put_nowait,
            {"event": "progress", "stage": stage, "detail": detail},
        )

    async def _run_pipeline() -> None:
        try:
            results = await run_in_threadpool(
                pipeline.recommend,
                progress=report_progress,
                **request,
            )
        except (RecommendationPipelineError, VectorIndexError) as exc:
            await queue.put({"event": "error", "detail": str(exc)})
        except Exception:
            await queue.put(
                {"event": "error", "detail": "internal error"}
            )
        else:
            response = _build_demo_response(
                results,
                pipeline=pipeline,
                settings=settings,
                candidate_limit=candidate_limit,
            )
            await queue.put(
                {
                    "event": "result",
                    "data": response.model_dump(by_alias=True),
                }
            )
        finally:
            await queue.put(None)

    async def _events() -> AsyncIterator[str]:
        task = asyncio.create_task(_run_pipeline())
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield json.dumps(item, ensure_ascii=False) + "\n"
        finally:
            task.cancel()

    return StreamingResponse(
        _events(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache"},
    )


@page_router.get(
    "/tpo-eval",
    response_class=HTMLResponse,
    include_in_schema=False,
)
def tpo_eval_page() -> HTMLResponse:
    try:
        html = _TPO_EVAL_HTML_PATH.read_text(encoding="utf-8")
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"demo asset unavailable: {exc}",
        ) from exc
    return HTMLResponse(html)


@tpo_api_router.get(
    "/queries",
    response_model=TpoQueriesResponse,
    summary="TPO 평가 쿼리셋 조회",
)
def tpo_eval_queries(
    settings: Settings = Depends(get_settings),
) -> TpoQueriesResponse:
    try:
        queries = load_tpo_queries(settings.tpo_eval_queries_path)
    except TpoEvalError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    return TpoQueriesResponse(
        schema_version="recommendation-tpo-eval-v1",
        queries=[
            TpoQueryItem(
                query_id=query.query_id,
                text=query.text,
                moods=list(query.moods),
                gender=str(query.filters.get("gender")),
                category=query.filters.get("category"),
                subcategory=query.filters.get("subcategory"),
                budget_min=int(query.filters.get("budget_min") or 0),
                budget_max=query.filters.get("budget_max"),
            )
            for query in queries
        ],
    )


@tpo_api_router.post(
    "/judgments",
    response_model=TpoJudgmentSaveResponse,
    summary="TPO 적합 판정 저장",
)
def tpo_eval_save_judgments(
    submission: TpoJudgmentSubmission,
    settings: Settings = Depends(get_settings),
) -> TpoJudgmentSaveResponse:
    try:
        queries = load_tpo_queries(settings.tpo_eval_queries_path)
    except TpoEvalError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    if submission.query_id not in {
        query.query_id for query in queries
    }:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"unknown queryId {submission.query_id!r}",
        )
    judged_at = datetime.now(timezone.utc).isoformat()
    saved = append_judgments(
        settings.tpo_eval_judgments_path,
        [
            TpoJudgment(
                evaluator=submission.evaluator.strip(),
                query_id=submission.query_id,
                product_id=item.product_id,
                rank=item.rank,
                fit=item.fit,
                index_version=submission.index_version,
                judged_at=judged_at,
            )
            for item in submission.judgments
        ],
    )
    return TpoJudgmentSaveResponse(saved=saved)


@tpo_api_router.get(
    "/summary",
    summary="TPO 적합률 집계",
)
def tpo_eval_summary(
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    try:
        queries = load_tpo_queries(settings.tpo_eval_queries_path)
        judgments = load_judgments(
            settings.tpo_eval_judgments_path
        )
    except TpoEvalError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    return summarize_judgments(judgments, queries)


def _demo_image_url(
    product: dict[str, object],
    settings: Settings,
) -> str:
    if settings.recommendation_demo_dataset_root is None:
        return str(product["image_url"])
    source = str(product["source"]).casefold()
    external_id = str(product["external_id"])
    if not source.replace("_", "").isalnum() or not external_id.isalnum():
        return str(product["image_url"])
    return f"/demo/catalog-images/{source}/{external_id}"
