from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx
import pytest
from PIL import Image

from app.recommendation.catalog import CatalogProduct
from app.recommendation.catalog_embeddings import (
    CatalogEmbeddingError,
    EmbeddingSettings,
    HttpProductImageResolver,
    OpenRouterEmbeddingProvider,
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
    model = "google/gemini-embedding-2"
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
    assert payload["model"] == "google/gemini-embedding-2"
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


def test_openrouter_provider_sends_joint_text_and_image_input() -> None:
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["headers"] = dict(request.headers)
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={"data": [{"embedding": [1.0] * 128}]},
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    provider = OpenRouterEmbeddingProvider(
        EmbeddingSettings(
            api_key="test-secret",
            dimensions=128,
            http_referer="https://gordi.example",
            app_title="Gordi Test",
        ),
        client=client,
    )

    values = provider.embed(
        document="title: 셔츠 | text: 여름",
        image=b"\xff\xd8image",
        mime_type="image/jpeg",
    )

    assert values == [1.0] * 128
    assert captured["url"] == (
        "https://openrouter.ai/api/v1/embeddings"
    )
    headers = captured["headers"]
    assert headers["authorization"] == "Bearer test-secret"
    assert headers["http-referer"] == "https://gordi.example"
    assert headers["x-title"] == "Gordi Test"
    assert captured["body"] == {
        "model": "google/gemini-embedding-2",
        "input": [
            {
                "content": [
                    {
                        "type": "text",
                        "text": "title: 셔츠 | text: 여름",
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": (
                                "data:image/jpeg;base64,/9hpbWFnZQ=="
                            )
                        },
                    },
                ]
            }
        ],
        "dimensions": 128,
        "encoding_format": "float",
        "provider": {
            "order": ["google-vertex"],
            "allow_fallbacks": False,
        },
    }
    client.close()


def test_openrouter_provider_sends_prefixed_text_query() -> None:
    bodies: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        bodies.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={"data": [{"embedding": [1.0] * 128}]},
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    provider = OpenRouterEmbeddingProvider(
        EmbeddingSettings(api_key="test-secret", dimensions=128),
        client=client,
    )

    provider.embed_query(text="여름 반팔", image=None, mime_type=None)

    assert bodies[0]["input"] == [
        {
            "content": [
                {
                    "type": "text",
                    "text": "task: search result | query: 여름 반팔",
                }
            ]
        }
    ]
    client.close()


def test_openrouter_provider_rejects_ambiguous_response() -> None:
    client = httpx.Client(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(200, json={"data": []})
        )
    )
    provider = OpenRouterEmbeddingProvider(
        EmbeddingSettings(api_key="test-secret", dimensions=128),
        client=client,
    )

    with pytest.raises(
        CatalogEmbeddingError,
        match="exactly one aggregated embedding",
    ):
        provider.embed_query(text="셔츠", image=None, mime_type=None)
    client.close()


def test_openrouter_provider_maps_http_error_without_secret() -> None:
    client = httpx.Client(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(
                401,
                json={"error": {"message": "invalid credentials"}},
            )
        )
    )
    provider = OpenRouterEmbeddingProvider(
        EmbeddingSettings(api_key="never-log-this", dimensions=128),
        client=client,
    )

    with pytest.raises(CatalogEmbeddingError) as error:
        provider.embed_query(text="셔츠", image=None, mime_type=None)

    assert "status 401" in str(error.value)
    assert "invalid credentials" in str(error.value)
    assert "never-log-this" not in str(error.value)
    client.close()


def test_openrouter_provider_rejects_empty_api_key() -> None:
    with pytest.raises(CatalogEmbeddingError, match="must not be empty"):
        OpenRouterEmbeddingProvider(EmbeddingSettings(api_key="  "))


def test_openrouter_provider_defaults_to_vertex_without_fallback() -> None:
    settings = EmbeddingSettings(api_key="openrouter-key")

    assert settings.provider_order == ("google-vertex",)
    assert settings.allow_fallbacks is False


def test_embedding_settings_read_openrouter_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "openrouter-key")
    monkeypatch.setenv(
        "OPENROUTER_EMBEDDING_MODEL",
        "google/gemini-embedding-2",
    )
    monkeypatch.setenv("OPENROUTER_EMBEDDING_DIMENSIONS", "1536")
    monkeypatch.setenv(
        "OPENROUTER_HTTP_REFERER",
        "https://gordi.example",
    )
    monkeypatch.setenv("OPENROUTER_APP_TITLE", "Gordi Test")
    monkeypatch.setenv(
        "OPENROUTER_PROVIDER_ORDER",
        "google-vertex, google-ai-studio",
    )
    monkeypatch.setenv("OPENROUTER_ALLOW_FALLBACKS", "false")
    monkeypatch.setenv("GEMINI_API_KEY", "legacy-key")

    settings = EmbeddingSettings.from_env()

    assert settings.api_key == "openrouter-key"
    assert settings.model == "google/gemini-embedding-2"
    assert settings.dimensions == 1536
    assert settings.http_referer == "https://gordi.example"
    assert settings.app_title == "Gordi Test"
    assert settings.provider_order == (
        "google-vertex",
        "google-ai-studio",
    )
    assert settings.allow_fallbacks is False


def test_embedding_settings_reject_invalid_fallback_flag(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "openrouter-key")
    monkeypatch.setenv("OPENROUTER_ALLOW_FALLBACKS", "sometimes")

    with pytest.raises(
        CatalogEmbeddingError,
        match="OPENROUTER_ALLOW_FALLBACKS must be true or false",
    ):
        EmbeddingSettings.from_env()


def test_checkpoint_written_per_paid_batch_not_per_item(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # 유료 임베딩 N건마다만 체크포인트를 쓴다 (매 아이템 전체 쓰기는
    # 카탈로그가 커지면 O(n^2) 디스크 쓰기가 된다). 크래시 시 마지막
    # 체크포인트까지의 유료 호출은 보존되어야 한다.
    import app.recommendation.catalog_embeddings as mod

    monkeypatch.setattr(mod, "_CHECKPOINT_EVERY_PAID", 2)

    class ExplodingProvider(FakeProvider):
        def embed(self, **kwargs):
            if len(self.calls) >= 3:
                raise CatalogEmbeddingError("provider down")
            return super().embed(**kwargs)

    products = [product(i) for i in range(1, 5)]
    output = tmp_path / "catalog.json"

    with pytest.raises(CatalogEmbeddingError, match="provider down"):
        build_catalog_embeddings(
            FakeRepository(products),
            FakeImageResolver(),
            ExplodingProvider(),
            output,
        )

    checkpoint = json.loads(
        (tmp_path / "catalog.json.checkpoint").read_text(encoding="utf-8")
    )
    assert checkpoint["status"] == "IN_PROGRESS"
    assert len(checkpoint["items"]) == 2  # 배치 경계까지 저장

    # 재실행: 체크포인트의 2건은 재사용, 나머지 2건만 재과금
    retry_provider = FakeProvider()
    report = build_catalog_embeddings(
        FakeRepository(products),
        FakeImageResolver(),
        retry_provider,
        output,
    )
    assert report.reused_count == 2
    assert report.embedded_count == 2
    assert not (tmp_path / "catalog.json.checkpoint").exists()
