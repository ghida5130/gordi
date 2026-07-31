from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from PIL import Image

from app.recommendation.catalog import CatalogProduct
from app.recommendation.catalog_embeddings import (
    CatalogEmbeddingError,
    HttpProductImageResolver,
    ResolvedImage,
    build_catalog_embeddings,
    format_catalog_document,
)


def product(
    product_id: int = 1,
    *,
    price: int = 50_000,
) -> CatalogProduct:
    return CatalogProduct(
        product_id=product_id,
        source="MUSINSA",
        external_id=str(3_000_000 + product_id),
        name="워시드 반팔 티셔츠",
        brand="테스트 브랜드",
        gender="MALE",
        price=price,
        category="TOP",
        subcategory="SHORT_SLEEVE",
        image_url=f"https://images.internal/{product_id}.jpg",
        purchase_url=f"https://shop.example/{product_id}",
        description="여유로운 핏의 캐주얼 상의",
        currency="KRW",
        availability="AVAILABLE",
    )


class FakeRepository:
    def __init__(self, products: list[CatalogProduct]) -> None:
        self.products = products
        self.limits: list[int | None] = []

    def load_available(
        self,
        *,
        limit: int | None = None,
    ) -> list[CatalogProduct]:
        self.limits.append(limit)
        return self.products if limit is None else self.products[:limit]


class FakeImageResolver:
    def resolve(self, item: CatalogProduct) -> ResolvedImage:
        return ResolvedImage(
            content=f"image-{item.product_id}".encode(),
            mime_type="image/jpeg",
            sha256=f"{item.product_id:064x}",
        )


class FakeProvider:
    model = "gemini-embedding-2"
    dimensions = 128

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def embed(
        self,
        *,
        document: str,
        image: bytes,
        mime_type: str,
    ) -> list[float]:
        self.calls.append(
            {
                "document": document,
                "image": image,
                "mime_type": mime_type,
            }
        )
        return [1.0] * self.dimensions


def test_catalog_document_uses_retrieval_document_format() -> None:
    item = product()

    document = format_catalog_document(item)

    assert document.startswith("title: 워시드 반팔 티셔츠 | text: ")
    assert "brand: 테스트 브랜드" in document
    assert "subcategory: SHORT_SLEEVE" in document
    assert item.image_url not in document
    assert str(item.price) not in document


def test_builds_normalized_aggregated_embedding_snapshot(
    tmp_path: Path,
) -> None:
    repository = FakeRepository([product()])
    provider = FakeProvider()
    output = tmp_path / "catalog.json"

    report = build_catalog_embeddings(
        repository,
        FakeImageResolver(),
        provider,
        output,
    )

    payload = json.loads(output.read_text(encoding="utf-8"))
    assert report.product_count == 1
    assert report.embedded_count == 1
    assert report.reused_count == 0
    assert payload["status"] == "COMPLETE"
    assert payload["model"] == "gemini-embedding-2"
    assert payload["dimensions"] == 128
    assert payload["product_count"] == 1
    assert payload["items"][0]["product"]["price"] == 50_000
    assert sum(
        value * value for value in payload["items"][0]["embedding"]
    ) == pytest.approx(1.0)
    assert provider.calls == [
        {
            "document": format_catalog_document(product()),
            "image": b"image-1",
            "mime_type": "image/jpeg",
        }
    ]
    assert not (tmp_path / "catalog.json.checkpoint").exists()


def test_reuses_embedding_when_only_nonsemantic_price_changes(
    tmp_path: Path,
) -> None:
    output = tmp_path / "catalog.json"
    first_provider = FakeProvider()
    build_catalog_embeddings(
        FakeRepository([product(price=50_000)]),
        FakeImageResolver(),
        first_provider,
        output,
    )
    second_provider = FakeProvider()

    report = build_catalog_embeddings(
        FakeRepository([product(price=45_000)]),
        FakeImageResolver(),
        second_provider,
        output,
    )

    payload = json.loads(output.read_text(encoding="utf-8"))
    assert report.embedded_count == 0
    assert report.reused_count == 1
    assert second_provider.calls == []
    assert payload["items"][0]["product"]["price"] == 45_000


def test_reembeds_when_semantic_metadata_changes(tmp_path: Path) -> None:
    output = tmp_path / "catalog.json"
    build_catalog_embeddings(
        FakeRepository([product()]),
        FakeImageResolver(),
        FakeProvider(),
        output,
    )
    changed = product()
    changed = CatalogProduct(
        **{**changed.metadata(), "description": "포멀한 슬림핏 상의"}
    )
    provider = FakeProvider()

    report = build_catalog_embeddings(
        FakeRepository([changed]),
        FakeImageResolver(),
        provider,
        output,
    )

    assert report.embedded_count == 1
    assert report.reused_count == 0
    assert len(provider.calls) == 1


def test_rejects_wrong_embedding_dimension_without_final_output(
    tmp_path: Path,
) -> None:
    class WrongProvider(FakeProvider):
        def embed(
            self,
            *,
            document: str,
            image: bytes,
            mime_type: str,
        ) -> list[float]:
            return [1.0, 2.0]

    output = tmp_path / "catalog.json"

    with pytest.raises(
        CatalogEmbeddingError,
        match="dimension mismatch",
    ):
        build_catalog_embeddings(
            FakeRepository([product()]),
            FakeImageResolver(),
            WrongProvider(),
            output,
        )

    assert not output.exists()


def test_local_image_resolver_accepts_one_primary_jpeg(
    tmp_path: Path,
) -> None:
    item = product()
    image_dir = (
        tmp_path / "images" / "musinsa" / item.external_id
    )
    image_dir.mkdir(parents=True)
    Image.new("RGB", (8, 8), "red").save(
        image_dir / "primary.jpg",
        format="JPEG",
    )

    with HttpProductImageResolver(dataset_root=tmp_path) as resolver:
        resolved = resolver.resolve(item)

    assert resolved.mime_type == "image/jpeg"
    assert len(resolved.sha256) == 64


def test_local_image_resolver_rejects_multiple_primary_files(
    tmp_path: Path,
) -> None:
    item = product()
    image_dir = (
        tmp_path / "images" / "musinsa" / item.external_id
    )
    image_dir.mkdir(parents=True)
    for name in ("primary.jpg", "primary.png"):
        Image.new("RGB", (8, 8), "red").save(image_dir / name)

    with HttpProductImageResolver(dataset_root=tmp_path) as resolver:
        with pytest.raises(
            CatalogEmbeddingError,
            match="exactly one local primary",
        ):
            resolver.resolve(item)
