"""Local-only FastAPI page and upload API for pipeline inspection."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

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
from fastapi.responses import FileResponse
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
from app.schemas.recommendation import (
    DemoRecommendationResponse,
    DemoRecommendedProduct,
)

_DEMO_HTML_PATH = (
    Path(__file__).resolve().parents[2]
    / "static"
    / "recommendation_demo.html"
)

page_router = APIRouter(
    prefix="/demo",
    dependencies=[Depends(require_recommendation_demo)],
)
api_router = APIRouter(
    prefix="/demo/recommendations",
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
    return FileResponse(matches[0])


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

    filters = SearchFilters(
        gender=gender,
        category=normalized_category,
        subcategory=normalized_subcategory,
        budget_min=budget_min,
        budget_max=budget_max,
    )
    try:
        results = await run_in_threadpool(
            pipeline.recommend,
            text=normalized_text,
            image=image_bytes,
            mime_type=image_mime_type,
            filters=filters,
            candidate_limit=candidate_limit,
            result_limit=result_limit,
        )
    except (RecommendationPipelineError, VectorIndexError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

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
