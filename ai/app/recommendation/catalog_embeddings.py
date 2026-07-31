"""Build a resumable Gemini multimodal embedding snapshot of the catalog."""

from __future__ import annotations

import hashlib
import io
import json
import math
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

import httpx
from PIL import Image, UnidentifiedImageError

from app.recommendation.catalog import CatalogProduct, CatalogRepository

CATALOG_EMBEDDING_SCHEMA_VERSION = "gordi-catalog-embedding-v1"
DEFAULT_MODEL = "gemini-embedding-2"
DEFAULT_DIMENSIONS = 768
MIN_DIMENSIONS = 128
MAX_DIMENSIONS = 3072
MAX_IMAGE_BYTES = 10 * 1024 * 1024


class CatalogEmbeddingError(RuntimeError):
    """Raised when no complete catalog embedding snapshot can be produced."""


@dataclass(frozen=True)
class EmbeddingSettings:
    api_key: str
    model: str = DEFAULT_MODEL
    dimensions: int = DEFAULT_DIMENSIONS

    @classmethod
    def from_env(cls) -> "EmbeddingSettings":
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key:
            raise CatalogEmbeddingError(
                "missing required environment variable: GEMINI_API_KEY"
            )
        model = os.environ.get(
            "GEMINI_EMBEDDING_MODEL",
            DEFAULT_MODEL,
        ).strip()
        try:
            dimensions = int(
                os.environ.get(
                    "GEMINI_EMBEDDING_DIMENSIONS",
                    str(DEFAULT_DIMENSIONS),
                )
            )
        except ValueError as exc:
            raise CatalogEmbeddingError(
                "GEMINI_EMBEDDING_DIMENSIONS must be an integer"
            ) from exc
        _validate_embedding_contract(model, dimensions)
        return cls(api_key=api_key, model=model, dimensions=dimensions)


@dataclass(frozen=True)
class ResolvedImage:
    content: bytes
    mime_type: str
    sha256: str


@dataclass(frozen=True)
class BuildReport:
    product_count: int
    embedded_count: int
    reused_count: int
    output_path: str
    snapshot_sha256: str


class MultimodalEmbeddingProvider(Protocol):
    model: str
    dimensions: int

    def embed(
        self,
        *,
        document: str,
        image: bytes,
        mime_type: str,
    ) -> list[float]:
        """Return one aggregated text-and-image embedding."""


class ProductImageResolver(Protocol):
    def resolve(self, product: CatalogProduct) -> ResolvedImage:
        """Resolve and validate one primary JPEG or PNG."""


class GeminiEmbeddingProvider:
    """Thin adapter around the official Google Gen AI Python SDK."""

    def __init__(self, settings: EmbeddingSettings) -> None:
        _validate_embedding_contract(settings.model, settings.dimensions)
        try:
            from google import genai
        except ImportError as exc:
            raise CatalogEmbeddingError(
                "google-genai is required for Gemini embeddings"
            ) from exc
        self.model = settings.model
        self.dimensions = settings.dimensions
        self._client = genai.Client(api_key=settings.api_key)

    def embed(
        self,
        *,
        document: str,
        image: bytes,
        mime_type: str,
    ) -> list[float]:
        return self._embed_parts(
            text=document,
            image=image,
            mime_type=mime_type,
        )

    def embed_query(
        self,
        *,
        text: str | None,
        image: bytes | None,
        mime_type: str | None,
    ) -> list[float]:
        query_text = None
        if text is not None and text.strip():
            query_text = (
                f"task: search result | query: {text.strip()}"
            )
        if query_text is None and image is None:
            raise CatalogEmbeddingError(
                "embedding query requires text or image"
            )
        return self._embed_parts(
            text=query_text,
            image=image,
            mime_type=mime_type,
        )

    def _embed_parts(
        self,
        *,
        text: str | None,
        image: bytes | None,
        mime_type: str | None,
    ) -> list[float]:
        from google.genai import types

        contents: list[Any] = []
        if text is not None:
            contents.append(text)
        if image is not None:
            if mime_type not in {"image/jpeg", "image/png"}:
                raise CatalogEmbeddingError(
                    "query image must be JPEG or PNG"
                )
            contents.append(
                types.Part.from_bytes(data=image, mime_type=mime_type)
            )
        try:
            result = self._client.models.embed_content(
                model=self.model,
                contents=contents,
                config=types.EmbedContentConfig(
                    output_dimensionality=self.dimensions
                ),
            )
        except Exception as exc:
            raise CatalogEmbeddingError(
                f"Gemini embed_content failed: {exc}"
            ) from exc
        embeddings = result.embeddings
        if embeddings is None or len(embeddings) != 1:
            raise CatalogEmbeddingError(
                "Gemini must return exactly one aggregated embedding"
            )
        values = embeddings[0].values
        if values is None:
            raise CatalogEmbeddingError("Gemini returned no embedding values")
        return list(values)


class HttpProductImageResolver:
    def __init__(
        self,
        *,
        dataset_root: Path | None = None,
        timeout_seconds: float = 20.0,
        client: httpx.Client | None = None,
    ) -> None:
        self._dataset_root = (
            None if dataset_root is None else dataset_root.resolve()
        )
        self._client = client or httpx.Client(
            follow_redirects=True,
            timeout=timeout_seconds,
        )
        self._owns_client = client is None

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> "HttpProductImageResolver":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def resolve(self, product: CatalogProduct) -> ResolvedImage:
        if self._dataset_root is not None:
            content = self._read_local_primary(product)
        else:
            try:
                response = self._client.get(product.image_url)
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise CatalogEmbeddingError(
                    f"product {product.product_id} image fetch failed: {exc}"
                ) from exc
            content = response.content
        if not content:
            raise CatalogEmbeddingError(
                f"product {product.product_id} image is empty"
            )
        if len(content) > MAX_IMAGE_BYTES:
            raise CatalogEmbeddingError(
                f"product {product.product_id} image exceeds "
                f"{MAX_IMAGE_BYTES} bytes"
            )
        mime_type = detect_image_mime(
            content,
            context=f"product {product.product_id}",
        )
        return ResolvedImage(
            content=content,
            mime_type=mime_type,
            sha256=_sha256_bytes(content),
        )

    def _read_local_primary(self, product: CatalogProduct) -> bytes:
        assert self._dataset_root is not None
        product_dir = (
            self._dataset_root
            / "images"
            / product.source.lower()
            / product.external_id
        ).resolve()
        try:
            product_dir.relative_to(self._dataset_root)
        except ValueError as exc:
            raise CatalogEmbeddingError(
                f"product {product.product_id} image path escapes dataset root"
            ) from exc
        matches = sorted(
            path
            for path in product_dir.glob("primary.*")
            if path.is_file()
        )
        if len(matches) != 1:
            raise CatalogEmbeddingError(
                f"product {product.product_id} requires exactly one local "
                f"primary image, found {len(matches)}"
            )
        try:
            return matches[0].read_bytes()
        except OSError as exc:
            raise CatalogEmbeddingError(
                f"product {product.product_id} image read failed: {exc}"
            ) from exc


def build_catalog_embeddings(
    repository: CatalogRepository,
    image_resolver: ProductImageResolver,
    provider: MultimodalEmbeddingProvider,
    output_path: Path,
    *,
    limit: int | None = None,
) -> BuildReport:
    """Build a complete snapshot, checkpointing paid calls atomically."""
    _validate_embedding_contract(provider.model, provider.dimensions)
    products = repository.load_available(limit=limit)
    if not products:
        raise CatalogEmbeddingError("catalog contains no AVAILABLE products")

    output_path = output_path.resolve()
    checkpoint_path = output_path.with_name(
        f"{output_path.name}.checkpoint"
    )
    reusable = _load_reusable_items(
        [output_path, checkpoint_path],
        provider.model,
        provider.dimensions,
    )
    items: list[dict[str, Any]] = []
    embedded_count = 0
    reused_count = 0

    for product in products:
        resolved = image_resolver.resolve(product)
        document = format_catalog_document(product)
        input_sha256 = _embedding_input_sha256(
            provider.model,
            provider.dimensions,
            document,
            resolved,
        )
        reused = reusable.get((product.product_id, input_sha256))
        if reused is not None:
            embedding = _validated_normalized_embedding(
                reused.get("embedding"),
                provider.dimensions,
            )
            reused_count += 1
        else:
            embedding = _validated_normalized_embedding(
                provider.embed(
                    document=document,
                    image=resolved.content,
                    mime_type=resolved.mime_type,
                ),
                provider.dimensions,
            )
            embedded_count += 1

        items.append(
            {
                "product": product.metadata(),
                "document": document,
                "image_sha256": resolved.sha256,
                "image_mime_type": resolved.mime_type,
                "embedding_input_sha256": input_sha256,
                "embedding": embedding,
            }
        )
        checkpoint = _snapshot_payload(
            items=items,
            model=provider.model,
            dimensions=provider.dimensions,
            expected_product_count=len(products),
            status="IN_PROGRESS",
        )
        _atomic_write_json(checkpoint_path, checkpoint)

    payload = _snapshot_payload(
        items=items,
        model=provider.model,
        dimensions=provider.dimensions,
        expected_product_count=len(products),
        status="COMPLETE",
    )
    _atomic_write_json(output_path, payload)
    try:
        checkpoint_path.unlink(missing_ok=True)
    except OSError as exc:
        raise CatalogEmbeddingError(
            f"cannot remove completed checkpoint: {exc}"
        ) from exc
    return BuildReport(
        product_count=len(items),
        embedded_count=embedded_count,
        reused_count=reused_count,
        output_path=str(output_path),
        snapshot_sha256=str(payload["snapshot_sha256"]),
    )


def format_catalog_document(product: CatalogProduct) -> str:
    """Create the retrieval-document side of Gemini's asymmetric format."""
    description = (product.description or product.name).strip()
    semantic_text = " | ".join(
        [
            f"brand: {product.brand}",
            f"gender: {product.gender}",
            f"category: {product.category}",
            f"subcategory: {product.subcategory}",
            f"description: {description}",
        ]
    )
    return f"title: {product.name} | text: {semantic_text}"


def _snapshot_payload(
    *,
    items: list[dict[str, Any]],
    model: str,
    dimensions: int,
    expected_product_count: int,
    status: str,
) -> dict[str, Any]:
    source_snapshot = [
        {
            "product": item["product"],
            "image_sha256": item["image_sha256"],
            "embedding_input_sha256": item["embedding_input_sha256"],
        }
        for item in items
    ]
    payload: dict[str, Any] = {
        "schema_version": CATALOG_EMBEDDING_SCHEMA_VERSION,
        "status": status,
        "model": model,
        "dimensions": dimensions,
        "normalized": True,
        "expected_product_count": expected_product_count,
        "product_count": len(items),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_snapshot_sha256": _sha256_json(source_snapshot),
        "items": items,
    }
    hashable = dict(payload)
    hashable.pop("generated_at")
    payload["snapshot_sha256"] = _sha256_json(hashable)
    return payload


def _load_reusable_items(
    paths: list[Path],
    model: str,
    dimensions: int,
) -> dict[tuple[int, str], dict[str, Any]]:
    reusable: dict[tuple[int, str], dict[str, Any]] = {}
    for path in paths:
        if not path.is_file():
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise CatalogEmbeddingError(
                f"cannot read existing embedding snapshot {path}: {exc}"
            ) from exc
        if (
            payload.get("schema_version")
            != CATALOG_EMBEDDING_SCHEMA_VERSION
            or payload.get("model") != model
            or payload.get("dimensions") != dimensions
        ):
            continue
        for item in payload.get("items", []):
            try:
                product_id = int(item["product"]["product_id"])
                input_sha256 = str(item["embedding_input_sha256"])
            except (KeyError, TypeError, ValueError):
                continue
            reusable[(product_id, input_sha256)] = item
    return reusable


def _embedding_input_sha256(
    model: str,
    dimensions: int,
    document: str,
    image: ResolvedImage,
) -> str:
    return _sha256_json(
        {
            "model": model,
            "dimensions": dimensions,
            "document": document,
            "image_sha256": image.sha256,
            "image_mime_type": image.mime_type,
            "aggregation": "text-and-image-parts",
        }
    )


def _validated_normalized_embedding(
    values: Any,
    dimensions: int,
) -> list[float]:
    if not isinstance(values, (list, tuple)) or len(values) != dimensions:
        actual = len(values) if isinstance(values, (list, tuple)) else None
        raise CatalogEmbeddingError(
            f"embedding dimension mismatch: expected {dimensions}, got {actual}"
        )
    try:
        converted = [float(value) for value in values]
    except (TypeError, ValueError) as exc:
        raise CatalogEmbeddingError(
            "embedding contains a non-numeric value"
        ) from exc
    if any(not math.isfinite(value) for value in converted):
        raise CatalogEmbeddingError("embedding contains a non-finite value")
    norm = math.sqrt(sum(value * value for value in converted))
    if norm == 0:
        raise CatalogEmbeddingError("embedding has zero norm")
    return [value / norm for value in converted]


def detect_image_mime(
    content: bytes,
    *,
    context: str = "image",
) -> str:
    try:
        with Image.open(io.BytesIO(content)) as image:
            image.verify()
            image_format = image.format
    except (OSError, UnidentifiedImageError) as exc:
        raise CatalogEmbeddingError(
            f"{context} is not decodable"
        ) from exc
    mime_types = {"JPEG": "image/jpeg", "PNG": "image/png"}
    if image_format not in mime_types:
        raise CatalogEmbeddingError(
            f"{context} format {image_format} is unsupported"
        )
    return mime_types[image_format]


def _validate_embedding_contract(model: str, dimensions: int) -> None:
    if not model.strip():
        raise CatalogEmbeddingError("embedding model must not be empty")
    if dimensions < MIN_DIMENSIONS or dimensions > MAX_DIMENSIONS:
        raise CatalogEmbeddingError(
            f"embedding dimensions must be between "
            f"{MIN_DIMENSIONS} and {MAX_DIMENSIONS}"
        )


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _sha256_json(value: Any) -> str:
    encoded = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return _sha256_bytes(encoded)


def _atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    try:
        temporary.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        temporary.replace(path)
    except OSError as exc:
        raise CatalogEmbeddingError(
            f"cannot write embedding snapshot {path}: {exc}"
        ) from exc
