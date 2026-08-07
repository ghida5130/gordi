from __future__ import annotations

import base64
import json
from typing import Any

import httpx
import pytest

from app.recommendation.image_attributes import (
    VLMImageAttributeExtractor,
    tags_from_payload,
)
from app.recommendation.pipeline import (
    GarmentTags,
    RecommendationPipeline,
)
from app.recommendation.vector_index import SearchFilters, SearchHit
from app.recommendation.vlm import (
    OpenAICompatibleVLMClient,
    VLMError,
    VLMSettings,
    image_part,
)
from tests.test_recommendation_pipeline import Retriever, product


def make_client(
    handler: Any,
    **settings_overrides: Any,
) -> OpenAICompatibleVLMClient:
    settings = VLMSettings(
        api_key="test-key",
        **settings_overrides,
    )
    transport = httpx.MockTransport(handler)
    return OpenAICompatibleVLMClient(
        settings,
        client=httpx.Client(transport=transport),
    )


def chat_response(content: str) -> httpx.Response:
    return httpx.Response(
        200,
        json={"choices": [{"message": {"content": content}}]},
    )


def test_client_sends_openai_compatible_payload() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers.get("Authorization")
        seen["payload"] = json.loads(request.content)
        return chat_response('{"colors": ["BLACK"]}')

    client = make_client(handler)
    result = client.complete_json(
        system="tagger",
        user_parts=[image_part(b"img", "image/jpeg")],
    )

    assert result == {"colors": ["BLACK"]}
    assert seen["url"] == VLMSettings().endpoint
    assert seen["auth"] == "Bearer test-key"
    payload = seen["payload"]
    assert payload["model"] == VLMSettings().model
    assert payload["temperature"] == 0.0
    assert payload["messages"][0]["role"] == "system"
    encoded = base64.b64encode(b"img").decode("ascii")
    assert payload["messages"][1]["content"][0]["image_url"]["url"] == (
        f"data:image/jpeg;base64,{encoded}"
    )


def test_client_allows_local_endpoint_without_api_key() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert "Authorization" not in request.headers
        return chat_response("{}")

    settings = VLMSettings(
        api_key="",
        endpoint="http://localhost:11434/v1/chat/completions",
        model="qwen3-vl:8b",
    )
    client = OpenAICompatibleVLMClient(
        settings,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    assert client.complete_json(system="s", user_parts=[]) == {}


def test_client_rejects_http_error_and_bad_content() -> None:
    def error_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"error": "rate limited"})

    with pytest.raises(VLMError, match="429"):
        make_client(error_handler).complete_text(
            system="s",
            user_parts=[],
        )

    def empty_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"choices": []})

    with pytest.raises(VLMError, match="content"):
        make_client(empty_handler).complete_text(
            system="s",
            user_parts=[],
        )


def test_client_reports_non_json_body_details() -> None:
    # keepalive filler 만 오고 JSON 없이 끝난 응답(212초 행 사건) —
    # 크기·스니펫이 에러 메시지에 남아야 로그로 원인 구분이 된다.
    def filler_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=" \n" * 266)

    with pytest.raises(VLMError, match="non-JSON") as excinfo:
        make_client(filler_handler).complete_text(
            system="s",
            user_parts=[],
        )
    message = str(excinfo.value)
    assert "532 bytes" in message
    assert "snippet" in message


def test_client_max_tokens_override_reaches_payload() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["payload"] = json.loads(request.content)
        return chat_response("{}")

    client = make_client(handler)
    client.complete_json(
        system="s",
        user_parts=[],
        max_tokens=64,
        reasoning_effort="low",
    )
    assert seen["payload"]["max_tokens"] == 64
    assert seen["payload"]["reasoning"] == {"effort": "low"}

    client.complete_json(system="s", user_parts=[])
    assert seen["payload"]["max_tokens"] == VLMSettings().max_output_tokens
    assert "reasoning" not in seen["payload"]

    with pytest.raises(VLMError, match="max_tokens"):
        client.complete_text(system="s", user_parts=[], max_tokens=0)

    with pytest.raises(VLMError, match="reasoning_effort"):
        client.complete_text(
            system="s",
            user_parts=[],
            reasoning_effort="extreme",
        )


def test_client_parses_fenced_json() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return chat_response(
            '```json\n{"colors": ["NAVY"]}\n```'
        )

    result = make_client(handler).complete_json(
        system="s",
        user_parts=[],
    )

    assert result == {"colors": ["NAVY"]}


def test_client_rejects_non_object_json() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return chat_response("코디 설명 텍스트")

    with pytest.raises(VLMError, match="JSON object"):
        make_client(handler).complete_json(system="s", user_parts=[])


def test_image_part_rejects_unsupported_mime() -> None:
    with pytest.raises(VLMError, match="JPEG or PNG"):
        image_part(b"img", "image/webp")


def test_tags_from_payload_drops_unknown_values() -> None:
    tags = tags_from_payload(
        {
            "colors": ["black", "NEON", 3],
            "seasons": ["SUMMER"],
            "styles": "casual",
            "patterns": ["stripe", "PAISLEY"],
        }
    )

    assert tags.colors == {"BLACK"}
    assert tags.seasons == {"SUMMER"}
    assert tags.styles == frozenset()
    assert tags.patterns == {"STRIPE"}


def test_extractor_returns_validated_tags() -> None:
    class Client:
        def complete_json(
            self,
            *,
            system: str,
            user_parts: list[dict[str, Any]],
        ) -> dict[str, Any]:
            assert "colors" in system
            assert user_parts[0]["type"] == "image_url"
            return {"colors": ["BLACK"], "seasons": ["summer"]}

    extractor = VLMImageAttributeExtractor(Client())
    tags = extractor.extract(image=b"img", mime_type="image/jpeg")

    assert tags == GarmentTags(
        colors=frozenset({"BLACK"}),
        seasons=frozenset({"SUMMER"}),
    )


class StaticExtractor:
    def __init__(self, tags: GarmentTags) -> None:
        self.tags = tags
        self.calls = 0

    def extract(
        self,
        *,
        image: bytes,
        mime_type: str,
    ) -> GarmentTags:
        self.calls += 1
        return self.tags


class FailingExtractor:
    def extract(
        self,
        *,
        image: bytes,
        mime_type: str,
    ) -> GarmentTags:
        raise VLMError("vlm unavailable")


def test_pipeline_merges_image_tags_into_intent() -> None:
    match = SearchHit(
        product_id=1,
        score=0.7,
        product=product(
            1,
            name="블랙 반팔",
            description="여름 데일리",
        ),
    )
    mismatch = SearchHit(
        product_id=2,
        score=0.7,
        product=product(
            2,
            name="레드 니트",
            description="겨울 의류",
            subcategory="KNIT",
        ),
    )
    extractor = StaticExtractor(
        GarmentTags(
            colors=frozenset({"BLACK"}),
            seasons=frozenset({"SUMMER"}),
        )
    )
    pipeline = RecommendationPipeline(
        Retriever([mismatch, match]),
        image_intent_extractor=extractor,
    )

    results = pipeline.recommend(
        text=None,
        image=b"jpeg",
        mime_type="image/jpeg",
        filters=SearchFilters(gender="MALE"),
    )

    assert extractor.calls == 1
    assert [result.product_id for result in results] == [1, 2]
    assert results[0].compatibility_score > (
        results[1].compatibility_score
    )
    assert "블랙" in results[0].reason


def test_pipeline_survives_extractor_failure() -> None:
    hit = SearchHit(
        product_id=1,
        score=0.8,
        product=product(1, name="기본 상의", description="기본"),
    )
    pipeline = RecommendationPipeline(
        Retriever([hit]),
        image_intent_extractor=FailingExtractor(),
    )

    results = pipeline.recommend(
        text=None,
        image=b"jpeg",
        mime_type="image/jpeg",
        filters=SearchFilters(gender="MALE"),
    )

    assert len(results) == 1


def test_text_pattern_keywords_participate_in_scoring() -> None:
    striped = SearchHit(
        product_id=1,
        score=0.7,
        product=product(
            1,
            name="스트라이프 반팔",
            description="줄무늬 티셔츠",
        ),
    )
    graphic = SearchHit(
        product_id=2,
        score=0.7,
        product=product(
            2,
            name="그래픽 반팔",
            description="프린트 티셔츠",
        ),
    )
    pipeline = RecommendationPipeline(Retriever([graphic, striped]))

    results = pipeline.recommend(
        text="스트라이프 반팔",
        image=None,
        mime_type=None,
        filters=SearchFilters(gender="MALE"),
    )

    assert [result.product_id for result in results] == [1, 2]
    assert "스트라이프 패턴" in results[0].reason
