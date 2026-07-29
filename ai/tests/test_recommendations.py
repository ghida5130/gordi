from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

RANK_URL = "/internal/v1/recommendations/rank"


def build_request(candidates: list[dict], limit: int = 12) -> dict:
    return {
        "recommendationId": 21,
        "condition": {
            "category": "TOP",
            "subcategory": "LONG_SLEEVE",
            "budgetMin": 30000,
            "budgetMax": 120000,
            "moods": ["MINIMAL", "CASUAL"],
        },
        "limit": limit,
        "candidates": candidates,
    }


def candidate(product_id: int, **overrides) -> dict:
    base = {
        "productId": product_id,
        "name": "기본 긴팔 티셔츠",
        "brand": "GORDI",
        "price": 59000,
        "category": "TOP",
        "subcategory": "LONG_SLEEVE",
        "colorGroup": "BLACK",
        "description": "데일리로 입기 좋은 미니멀 솔리드 긴팔",
    }
    base.update(overrides)
    return base


def test_rank_returns_camel_case_contract() -> None:
    response = client.post(RANK_URL, json=build_request([candidate(101)]))

    assert response.status_code == 200
    body = response.json()
    assert body["schemaVersion"] == "1.0"
    assert body["ranked"][0]["productId"] == 101
    assert body["ranked"][0]["rank"] == 1
    assert 0.0 <= body["ranked"][0]["score"] <= 1.0


def test_rank_assigns_sequential_ranks_and_respects_limit() -> None:
    candidates = [candidate(product_id, price=30000 + product_id) for product_id in range(1, 21)]

    response = client.post(RANK_URL, json=build_request(candidates, limit=12))

    ranked = response.json()["ranked"]
    assert len(ranked) == 12
    assert [item["rank"] for item in ranked] == list(range(1, 13))
    scores = [item["score"] for item in ranked]
    assert scores == sorted(scores, reverse=True)


def test_mood_matching_product_outranks_unrelated_product() -> None:
    matching = candidate(101, description="미니멀 솔리드 데일리 긴팔")
    unrelated = candidate(102, description="화려한 플로럴 프린트", colorGroup="PINK")

    response = client.post(RANK_URL, json=build_request([unrelated, matching]))

    assert response.json()["ranked"][0]["productId"] == 101


def test_price_near_sweet_spot_outranks_edge_price() -> None:
    # 예산 30000~120000 의 선호 지점은 84000
    near = candidate(201, price=84000, description=None, colorGroup=None)
    far = candidate(202, price=120000, description=None, colorGroup=None)

    response = client.post(RANK_URL, json=build_request([far, near]))

    assert response.json()["ranked"][0]["productId"] == 201


def test_empty_candidates_return_empty_ranking() -> None:
    response = client.post(RANK_URL, json=build_request([]))

    assert response.status_code == 200
    assert response.json()["ranked"] == []


def test_tie_is_broken_by_price_then_product_id() -> None:
    # 가격 외 조건이 같으면 동점 → 선호 지점에 가까운 가격, 같은 가격이면 낮은 id
    same_price_high_id = candidate(310)
    same_price_low_id = candidate(309)

    response = client.post(RANK_URL, json=build_request([same_price_high_id, same_price_low_id]))

    assert [item["productId"] for item in response.json()["ranked"]] == [309, 310]


def test_ranking_is_stable_across_repeated_calls() -> None:
    candidates = [candidate(pid, price=40000 + pid * 1000) for pid in range(1, 6)]
    payload = build_request(candidates)

    first = client.post(RANK_URL, json=payload).json()
    second = client.post(RANK_URL, json=payload).json()

    assert first == second


def test_invalid_body_returns_422() -> None:
    response = client.post(RANK_URL, json={"condition": {"category": "TOP"}})

    assert response.status_code == 422
