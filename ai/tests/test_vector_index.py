from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.recommendation.catalog import CatalogProduct
from app.recommendation.catalog_embeddings import (
    ResolvedImage,
    build_catalog_embeddings,
)
from app.recommendation.vector_index import (
    CandidateRetriever,
    CatalogVectorIndex,
    SearchFilters,
    VectorIndexError,
)

DIMENSIONS = 128


def vector(first: float, second: float) -> list[float]:
    return [first, second] + [0.0] * (DIMENSIONS - 2)


def product(
    product_id: int,
    *,
    gender: str = "MALE",
    category: str = "TOP",
    subcategory: str = "SHORT_SLEEVE",
    price: int = 50_000,
) -> CatalogProduct:
    return CatalogProduct(
        product_id=product_id,
        source="MUSINSA",
        external_id=str(3_000_000 + product_id),
        name=f"상품 {product_id}",
        brand="테스트",
        gender=gender,
        price=price,
        category=category,
        subcategory=subcategory,
        image_url=f"https://images.internal/{product_id}.jpg",
        purchase_url=f"https://shop.example/{product_id}",
        description="캐주얼 의류",
        currency="KRW",
        availability="AVAILABLE",
    )


class Repository:
    def __init__(self, products: list[CatalogProduct]) -> None:
        self.products = products

    def load_available(
        self,
        *,
        limit: int | None = None,
    ) -> list[CatalogProduct]:
        return self.products if limit is None else self.products[:limit]


class Images:
    def resolve(self, item: CatalogProduct) -> ResolvedImage:
        content = str(item.product_id).encode()
        return ResolvedImage(
            content=content,
            mime_type="image/jpeg",
            sha256=f"{item.product_id:064x}",
        )


class CatalogProvider:
    model = "google/gemini-embedding-2"
    dimensions = DIMENSIONS

    def __init__(self, vectors: dict[int, list[float]]) -> None:
        self.vectors = vectors

    def embed(
        self,
        *,
        document: str,
        image: bytes,
        mime_type: str,
    ) -> list[float]:
        return self.vectors[int(image.decode())]


class QueryProvider:
    model = "google/gemini-embedding-2"
    dimensions = DIMENSIONS

    def __init__(self, result: list[float]) -> None:
        self.result = result
        self.calls: list[dict[str, Any]] = []

    def embed_query(
        self,
        *,
        text: str | None,
        image: bytes | None,
        mime_type: str | None,
    ) -> list[float]:
        self.calls.append(
            {
                "text": text,
                "image": image,
                "mime_type": mime_type,
            }
        )
        return self.result


def build_index(
    tmp_path: Path,
    products: list[CatalogProduct],
    vectors: dict[int, list[float]],
) -> tuple[Path, CatalogVectorIndex]:
    path = tmp_path / "catalog.json"
    build_catalog_embeddings(
        Repository(products),
        Images(),
        CatalogProvider(vectors),
        path,
    )
    return path, CatalogVectorIndex.load(path)


def test_search_prefilters_gender_category_and_budget(
    tmp_path: Path,
) -> None:
    products = [
        product(1),
        product(2, gender="UNISEX"),
        product(3, gender="FEMALE"),
        product(4, category="BOTTOM", subcategory="DENIM_PANTS"),
        product(5, price=100_001),
    ]
    _, index = build_index(
        tmp_path,
        products,
        {
            1: vector(0.8, 0.2),
            2: vector(0.7, 0.3),
            3: vector(1.0, 0.0),
            4: vector(1.0, 0.0),
            5: vector(1.0, 0.0),
        },
    )

    hits = index.search(
        vector(1.0, 0.0),
        SearchFilters(
            gender="MALE",
            category="TOP",
            budget_max=100_000,
        ),
    )

    assert [hit.product_id for hit in hits] == [1, 2]
    assert hits[0].score > hits[1].score


def test_search_uses_product_id_as_deterministic_tie_breaker(
    tmp_path: Path,
) -> None:
    _, index = build_index(
        tmp_path,
        [product(2), product(1)],
        {
            1: vector(1.0, 0.0),
            2: vector(1.0, 0.0),
        },
    )

    hits = index.search(
        vector(1.0, 0.0),
        SearchFilters(gender="MALE"),
        limit=1,
    )

    assert [hit.product_id for hit in hits] == [1]


def test_candidate_retriever_embeds_multimodal_query_once(
    tmp_path: Path,
) -> None:
    _, index = build_index(
        tmp_path,
        [product(1)],
        {1: vector(1.0, 0.0)},
    )
    provider = QueryProvider(vector(1.0, 0.0))
    retriever = CandidateRetriever(index, provider)

    hits = retriever.retrieve(
        text="여름 캐주얼 반팔",
        image=b"jpeg",
        mime_type="image/jpeg",
        filters=SearchFilters(gender="MALE"),
    )

    assert [hit.product_id for hit in hits] == [1]
    assert provider.calls == [
        {
            "text": "여름 캐주얼 반팔",
            "image": b"jpeg",
            "mime_type": "image/jpeg",
        }
    ]


def test_candidate_retriever_requires_matching_model(
    tmp_path: Path,
) -> None:
    _, index = build_index(
        tmp_path,
        [product(1)],
        {1: vector(1.0, 0.0)},
    )
    provider = QueryProvider(vector(1.0, 0.0))
    provider.model = "different-model"

    with pytest.raises(VectorIndexError, match="model does not match"):
        CandidateRetriever(index, provider)


def test_load_rejects_tampered_snapshot(tmp_path: Path) -> None:
    path, _ = build_index(
        tmp_path,
        [product(1)],
        {1: vector(1.0, 0.0)},
    )
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["items"][0]["product"]["price"] = 1
    path.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(
        VectorIndexError,
        match="snapshot_sha256 mismatch",
    ):
        CatalogVectorIndex.load(path)


def test_load_rejects_non_object_item_with_domain_error(
    tmp_path: Path,
) -> None:
    path, _ = build_index(
        tmp_path,
        [product(1)],
        {1: vector(1.0, 0.0)},
    )
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["items"][0] = None
    payload.pop("snapshot_sha256")
    from app.recommendation.vector_index import _snapshot_sha256

    payload["snapshot_sha256"] = _snapshot_sha256(payload)
    path.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(
        VectorIndexError,
        match="item must be an object",
    ):
        CatalogVectorIndex.load(path)


def test_load_rejects_unsafe_product_url(tmp_path: Path) -> None:
    path, _ = build_index(
        tmp_path,
        [product(1)],
        {1: vector(1.0, 0.0)},
    )
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["items"][0]["product"]["purchase_url"] = "javascript:alert(1)"
    payload.pop("snapshot_sha256")
    from app.recommendation.vector_index import _snapshot_sha256

    payload["snapshot_sha256"] = _snapshot_sha256(payload)
    path.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(VectorIndexError, match="purchase_url is invalid"):
        CatalogVectorIndex.load(path)


def _rewrite_image_url(path: Path, value: str) -> None:
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["items"][0]["product"]["image_url"] = value
    payload.pop("snapshot_sha256")
    from app.recommendation.vector_index import _snapshot_sha256

    payload["snapshot_sha256"] = _snapshot_sha256(payload)
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_load_accepts_object_key_image_url(tmp_path: Path) -> None:
    # 백엔드 규약(2026-08-04): DB 는 image_url 에 S3 객체 키만 저장.
    path, _ = build_index(
        tmp_path, [product(1)], {1: vector(1.0, 0.0)}
    )
    _rewrite_image_url(
        path, "garments/musinsa/3000001/primary-abcd1234.jpg"
    )

    index = CatalogVectorIndex.load(path)

    assert index.product_by_id(1)["image_url"].startswith("garments/")


@pytest.mark.parametrize(
    "bad_url",
    ["javascript:alert(1)", "//evil.example/x.jpg", "   "],
)
def test_load_rejects_unsafe_image_url(
    tmp_path: Path,
    bad_url: str,
) -> None:
    path, _ = build_index(
        tmp_path, [product(1)], {1: vector(1.0, 0.0)}
    )
    _rewrite_image_url(path, bad_url)

    # 공백뿐인 값은 필수 필드 검사("missing fields")에서, 나머지는
    # URL 형식 검사("is invalid")에서 걸린다 — 둘 다 image_url 거부.
    with pytest.raises(VectorIndexError, match="image_url"):
        CatalogVectorIndex.load(path)


@pytest.mark.parametrize(
    ("filters", "message"),
    [
        (SearchFilters(gender="UNISEX"), "gender"),
        (
            SearchFilters(
                gender="MALE",
                budget_min=10,
                budget_max=9,
            ),
            "budget_min",
        ),
    ],
)
def test_search_rejects_invalid_filters(
    tmp_path: Path,
    filters: SearchFilters,
    message: str,
) -> None:
    _, index = build_index(
        tmp_path,
        [product(1)],
        {1: vector(1.0, 0.0)},
    )

    with pytest.raises(VectorIndexError, match=message):
        index.search(vector(1.0, 0.0), filters)
