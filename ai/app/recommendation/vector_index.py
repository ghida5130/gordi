"""Validated in-memory cosine index with metadata pre-filtering."""

from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import urlsplit

from app.recommendation.catalog_embeddings import (
    CATALOG_EMBEDDING_SCHEMA_VERSION,
    CatalogEmbeddingError,
)

DEFAULT_RETRIEVAL_LIMIT = 50
MAX_RETRIEVAL_LIMIT = 200
_ALLOWED_QUERY_GENDERS = {"MALE", "FEMALE"}
_ALLOWED_PRODUCT_GENDERS = _ALLOWED_QUERY_GENDERS | {"UNISEX"}


class VectorIndexError(RuntimeError):
    """Raised when an embedding snapshot or search request is invalid."""


@dataclass(frozen=True)
class SearchFilters:
    gender: str
    category: str | None = None
    subcategory: str | None = None
    budget_min: int = 0
    budget_max: int | None = None

    def validate(self) -> None:
        if self.gender not in _ALLOWED_QUERY_GENDERS:
            raise VectorIndexError("gender must be MALE or FEMALE")
        if self.category is not None and not self.category.strip():
            raise VectorIndexError("category must not be blank")
        if self.subcategory is not None and not self.subcategory.strip():
            raise VectorIndexError("subcategory must not be blank")
        if self.budget_min < 0:
            raise VectorIndexError("budget_min must not be negative")
        if self.budget_max is not None:
            if self.budget_max < 0:
                raise VectorIndexError("budget_max must not be negative")
            if self.budget_min > self.budget_max:
                raise VectorIndexError(
                    "budget_min must be less than or equal to budget_max"
                )


@dataclass(frozen=True)
class SearchHit:
    product_id: int
    score: float
    product: dict[str, Any]


@dataclass(frozen=True)
class _IndexItem:
    product: dict[str, Any]
    embedding: tuple[float, ...]


class QueryEmbeddingProvider(Protocol):
    model: str
    dimensions: int

    def embed_query(
        self,
        *,
        text: str | None,
        image: bytes | None,
        mime_type: str | None,
    ) -> list[float]:
        """Embed optional text and image into the catalog vector space."""


class CatalogVectorIndex:
    def __init__(
        self,
        *,
        model: str,
        dimensions: int,
        snapshot_sha256: str,
        items: list[_IndexItem],
    ) -> None:
        if not items:
            raise VectorIndexError("vector index must not be empty")
        self.model = model
        self.dimensions = dimensions
        self.snapshot_sha256 = snapshot_sha256
        self._items = tuple(items)

    @classmethod
    def load(cls, path: Path) -> "CatalogVectorIndex":
        path = path.resolve()
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise VectorIndexError(
                f"cannot read vector index {path}: {exc}"
            ) from exc
        _validate_snapshot(payload)
        dimensions = int(payload["dimensions"])
        items: list[_IndexItem] = []
        seen_product_ids: set[int] = set()
        for raw_item in payload["items"]:
            if not isinstance(raw_item, dict):
                raise VectorIndexError(
                    "vector index item must be an object"
                )
            product = raw_item.get("product")
            if not isinstance(product, dict):
                raise VectorIndexError(
                    "vector index product metadata must be an object"
                )
            try:
                product_id = int(product["product_id"])
            except (KeyError, TypeError, ValueError) as exc:
                raise VectorIndexError(
                    "index item has an invalid product_id"
                ) from exc
            if isinstance(product.get("product_id"), bool):
                raise VectorIndexError(
                    "index item has an invalid product_id"
                )
            if product_id in seen_product_ids:
                raise VectorIndexError(
                    f"duplicate product_id in index: {product_id}"
                )
            seen_product_ids.add(product_id)
            _validate_product_metadata(product, product_id)
            embedding = _normalized_vector(
                raw_item.get("embedding"),
                dimensions,
            )
            items.append(
                _IndexItem(
                    product=dict(product),
                    embedding=tuple(embedding),
                )
            )
        return cls(
            model=str(payload["model"]),
            dimensions=dimensions,
            snapshot_sha256=str(payload["snapshot_sha256"]),
            items=items,
        )

    @property
    def product_count(self) -> int:
        return len(self._items)

    @property
    def products(self) -> list[dict[str, Any]]:
        return [dict(item.product) for item in self._items]

    def embedding_of(
        self,
        source: str,
        external_id: str,
    ) -> list[float] | None:
        for item in self._items:
            if (
                item.product["source"] == source
                and item.product["external_id"] == external_id
            ):
                return list(item.embedding)
        return None

    def embedding_by_product_id(
        self,
        product_id: int,
    ) -> tuple[float, ...] | None:
        by_id = getattr(self, "_embeddings_by_product_id", None)
        if by_id is None:
            by_id = {
                int(item.product["product_id"]): item.embedding
                for item in self._items
            }
            self._embeddings_by_product_id = by_id
        return by_id.get(int(product_id))

    def product_by_id(self, product_id: int) -> dict[str, Any] | None:
        """Snapshot metadata (incl. image_url) for a backend DB id."""
        by_id = getattr(self, "_products_by_id", None)
        if by_id is None:
            by_id = {
                int(item.product["product_id"]): item.product
                for item in self._items
            }
            self._products_by_id = by_id
        product = by_id.get(int(product_id))
        return None if product is None else dict(product)

    def search(
        self,
        query_embedding: list[float],
        filters: SearchFilters,
        *,
        limit: int = DEFAULT_RETRIEVAL_LIMIT,
    ) -> list[SearchHit]:
        filters.validate()
        if limit <= 0 or limit > MAX_RETRIEVAL_LIMIT:
            raise VectorIndexError(
                f"limit must be between 1 and {MAX_RETRIEVAL_LIMIT}"
            )
        query = _normalized_vector(query_embedding, self.dimensions)
        hits: list[SearchHit] = []
        for item in self._items:
            if not _matches_filters(item.product, filters):
                continue
            score = sum(
                left * right
                for left, right in zip(
                    query,
                    item.embedding,
                    strict=True,
                )
            )
            hits.append(
                SearchHit(
                    product_id=int(item.product["product_id"]),
                    score=max(-1.0, min(1.0, score)),
                    product=dict(item.product),
                )
            )
        hits.sort(key=lambda hit: (-hit.score, hit.product_id))
        return hits[:limit]


class CandidateRetriever:
    """Embed one user query and search the matching catalog snapshot."""

    def __init__(
        self,
        index: CatalogVectorIndex,
        provider: QueryEmbeddingProvider,
    ) -> None:
        if index.model != provider.model:
            raise VectorIndexError(
                "query provider model does not match vector index"
            )
        if index.dimensions != provider.dimensions:
            raise VectorIndexError(
                "query provider dimensions do not match vector index"
            )
        self._index = index
        self._provider = provider

    def retrieve(
        self,
        *,
        text: str | None,
        image: bytes | None,
        mime_type: str | None,
        filters: SearchFilters,
        limit: int = DEFAULT_RETRIEVAL_LIMIT,
    ) -> list[SearchHit]:
        if (text is None or not text.strip()) and image is None:
            raise VectorIndexError("query requires text or image")
        if image is None and mime_type is not None:
            raise VectorIndexError(
                "mime_type must be omitted when image is omitted"
            )
        if image is not None and mime_type not in {
            "image/jpeg",
            "image/png",
        }:
            raise VectorIndexError("query image must be JPEG or PNG")
        try:
            query_embedding = self._provider.embed_query(
                text=text,
                image=image,
                mime_type=mime_type,
            )
        except CatalogEmbeddingError as exc:
            raise VectorIndexError(str(exc)) from exc
        return self._index.search(
            query_embedding,
            filters,
            limit=limit,
        )


def _validate_snapshot(payload: Any) -> None:
    if not isinstance(payload, dict):
        raise VectorIndexError("vector index root must be an object")
    if (
        payload.get("schema_version")
        != CATALOG_EMBEDDING_SCHEMA_VERSION
    ):
        raise VectorIndexError("unsupported vector index schema")
    if payload.get("status") != "COMPLETE":
        raise VectorIndexError("vector index snapshot is not COMPLETE")
    if not isinstance(payload.get("model"), str) or not payload["model"]:
        raise VectorIndexError("vector index model is missing")
    dimensions = payload.get("dimensions")
    if (
        not isinstance(dimensions, int)
        or isinstance(dimensions, bool)
        or dimensions <= 0
    ):
        raise VectorIndexError("vector index dimensions are invalid")
    items = payload.get("items")
    if not isinstance(items, list):
        raise VectorIndexError("vector index items must be an array")
    if payload.get("product_count") != len(items):
        raise VectorIndexError("vector index product_count mismatch")
    if payload.get("expected_product_count") != len(items):
        raise VectorIndexError(
            "vector index expected_product_count mismatch"
        )
    actual_sha256 = _snapshot_sha256(payload)
    if payload.get("snapshot_sha256") != actual_sha256:
        raise VectorIndexError("vector index snapshot_sha256 mismatch")


def _validate_product_metadata(
    product: Any,
    product_id: int,
) -> None:
    if not isinstance(product, dict):
        raise VectorIndexError(
            f"product {product_id} metadata must be an object"
        )
    required_strings = (
        "name",
        "brand",
        "source",
        "external_id",
        "gender",
        "category",
        "subcategory",
        "image_url",
        "purchase_url",
        "currency",
        "availability",
    )
    missing = [
        field
        for field in required_strings
        if not isinstance(product.get(field), str)
        or not product[field].strip()
    ]
    if missing:
        raise VectorIndexError(
            f"product {product_id} metadata missing fields: {missing}"
        )
    if product["gender"] not in _ALLOWED_PRODUCT_GENDERS:
        raise VectorIndexError(
            f"product {product_id} gender is invalid"
        )
    if product["availability"] != "AVAILABLE":
        raise VectorIndexError(
            f"product {product_id} is not AVAILABLE"
        )
    for field in ("image_url", "purchase_url"):
        parsed = urlsplit(product[field])
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise VectorIndexError(
                f"product {product_id} {field} is invalid"
            )
    price = product.get("price")
    if (
        not isinstance(price, int)
        or isinstance(price, bool)
        or price < 0
    ):
        raise VectorIndexError(
            f"product {product_id} price is invalid"
        )


def _matches_filters(
    product: dict[str, Any],
    filters: SearchFilters,
) -> bool:
    if product["availability"] != "AVAILABLE":
        return False
    if product["gender"] not in {filters.gender, "UNISEX"}:
        return False
    if (
        filters.category is not None
        and product["category"] != filters.category
    ):
        return False
    if (
        filters.subcategory is not None
        and product["subcategory"] != filters.subcategory
    ):
        return False
    price = int(product["price"])
    if price < filters.budget_min:
        return False
    if filters.budget_max is not None and price > filters.budget_max:
        return False
    return True


def _normalized_vector(values: Any, dimensions: int) -> list[float]:
    if not isinstance(values, (list, tuple)) or len(values) != dimensions:
        actual = len(values) if isinstance(values, (list, tuple)) else None
        raise VectorIndexError(
            f"vector dimension mismatch: expected {dimensions}, got {actual}"
        )
    try:
        converted = [float(value) for value in values]
    except (TypeError, ValueError) as exc:
        raise VectorIndexError("vector contains non-numeric values") from exc
    if any(not math.isfinite(value) for value in converted):
        raise VectorIndexError("vector contains non-finite values")
    norm = math.sqrt(sum(value * value for value in converted))
    if norm == 0:
        raise VectorIndexError("vector has zero norm")
    return [value / norm for value in converted]


def _snapshot_sha256(payload: dict[str, Any]) -> str:
    hashable = dict(payload)
    hashable.pop("generated_at", None)
    hashable.pop("snapshot_sha256", None)
    encoded = json.dumps(
        hashable,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()
