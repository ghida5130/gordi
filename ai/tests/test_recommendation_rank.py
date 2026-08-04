from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.api.routes.internal_recommendations import get_vector_ranker
from app.core.config import get_settings
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_internal_api_key(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[None]:
    monkeypatch.setenv("INTERNAL_API_KEY", "")
    get_settings.cache_clear()
    # 이 파일은 keyword baseline 계약을 검증한다. 개발 머신에 실제
    # 인덱스/API 키가 있으면 벡터 경로(라이브 임베딩 호출)로 새기
    # 때문에 vector ranker 를 명시적으로 비활성화한다.
    app.dependency_overrides[get_vector_ranker] = lambda: None
    yield
    app.dependency_overrides.pop(get_vector_ranker, None)
    get_settings.cache_clear()


def rank_payload() -> dict[str, object]:
    return {
        "recommendationId": 77,
        "condition": {
            "gender": "MALE",
            "category": "TOP",
            "subcategory": "SHORT_SLEEVE",
            "budgetMin": 0,
            "budgetMax": 100_000,
            "moods": ["CASUAL"],
        },
        "limit": 2,
        "candidates": [
            {
                "productId": 101,
                "name": "Casual T-shirt",
                "brand": "Alpha",
                "price": 50_000,
                "gender": "MALE",
                "category": "TOP",
                "subcategory": "SHORT_SLEEVE",
                "description": "Daily casual garment",
            },
            {
                "productId": 102,
                "name": "Basic T-shirt",
                "brand": "Beta",
                "price": 50_000,
                "gender": "UNISEX",
                "category": "TOP",
                "subcategory": "SHORT_SLEEVE",
                "description": None,
            },
            {
                "productId": 103,
                "name": "Casual T-shirt",
                "brand": "Gamma",
                "price": 0,
                "gender": "MALE",
                "category": "TOP",
                "subcategory": "SHORT_SLEEVE",
                "description": "Casual",
            },
        ],
    }


def test_rank_matches_backend_contract_and_limit() -> None:
    response = client.post(
        "/internal/v1/recommendations/rank",
        json=rank_payload(),
    )

    assert response.status_code == 200
    assert response.json() == {
        "schemaVersion": "2.0",
        "ranked": [
            {"productId": 101, "rank": 1, "score": 1.0},
            {"productId": 102, "rank": 2, "score": 0.7},
        ],
    }


def test_rank_filters_candidates_outside_backend_condition() -> None:
    payload = rank_payload()
    payload["limit"] = 10
    candidates = payload["candidates"]
    assert isinstance(candidates, list)
    candidates.extend(
        [
            {
                "productId": 104,
                "name": "Wrong category",
                "brand": "Delta",
                "price": 50_000,
                "gender": "MALE",
                "category": "BOTTOM",
                "subcategory": "DENIM_PANTS",
                "description": "Casual",
            },
            {
                "productId": 105,
                "name": "Over budget",
                "brand": "Epsilon",
                "price": 100_001,
                "gender": "MALE",
                "category": "TOP",
                "subcategory": "SHORT_SLEEVE",
                "description": "Casual",
            },
        ]
    )

    response = client.post(
        "/internal/v1/recommendations/rank",
        json=payload,
    )

    assert response.status_code == 200
    returned_ids = {item["productId"] for item in response.json()["ranked"]}
    assert returned_ids == {101, 102, 103}


def test_rank_filters_candidates_for_another_gender() -> None:
    payload = rank_payload()
    payload["limit"] = 10
    candidates = payload["candidates"]
    assert isinstance(candidates, list)
    candidates.append(
        {
            "productId": 106,
            "name": "Female casual top",
            "brand": "Zeta",
            "price": 50_000,
            "gender": "FEMALE",
            "category": "TOP",
            "subcategory": "SHORT_SLEEVE",
            "description": "Casual",
        }
    )

    response = client.post(
        "/internal/v1/recommendations/rank",
        json=payload,
    )

    assert response.status_code == 200
    returned_ids = {item["productId"] for item in response.json()["ranked"]}
    assert 106 not in returned_ids
    assert 102 in returned_ids


def test_rank_rejects_invalid_budget_range() -> None:
    payload = rank_payload()
    condition = payload["condition"]
    assert isinstance(condition, dict)
    condition["budgetMin"] = 100_001

    response = client.post(
        "/internal/v1/recommendations/rank",
        json=payload,
    )

    assert response.status_code == 422


def test_rank_rejects_duplicate_candidate_product_ids() -> None:
    payload = rank_payload()
    candidates = payload["candidates"]
    assert isinstance(candidates, list)
    duplicate = dict(candidates[0])
    candidates.append(duplicate)

    response = client.post(
        "/internal/v1/recommendations/rank",
        json=payload,
    )

    assert response.status_code == 422


def test_internal_api_key_is_required_when_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("INTERNAL_API_KEY", "test-secret")
    get_settings.cache_clear()

    missing = client.post(
        "/internal/v1/recommendations/rank",
        json=rank_payload(),
    )
    wrong = client.post(
        "/internal/v1/recommendations/rank",
        headers={"X-Internal-Api-Key": "wrong"},
        json=rank_payload(),
    )
    accepted = client.post(
        "/internal/v1/recommendations/rank",
        headers={"X-Internal-Api-Key": "test-secret"},
        json=rank_payload(),
    )

    assert missing.status_code == 401
    assert wrong.status_code == 401
    assert accepted.status_code == 200
