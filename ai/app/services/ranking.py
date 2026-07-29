"""추천 후보 순위 계산.

Spring 이 판매 상태·카테고리·예산 필터링을 끝낸 뒤 후보 목록을 넘기고,
여기서는 조건과의 적합도만 계산해 순위를 매긴다. 후보를 추가하거나
예산을 확대하는 일은 하지 않는다.
"""

from app.schemas.recommendation import (
    RankCandidate,
    RankCondition,
    RankedProduct,
    RankRequest,
    RankResponse,
)

SCHEMA_VERSION = "1.0"

# 가중치 (합 1.0)
WEIGHT_MOOD = 0.45
WEIGHT_BUDGET = 0.30
WEIGHT_SUBCATEGORY = 0.15
WEIGHT_METADATA = 0.10

# 예산 구간에서 선호하는 지점 (하단 60% 지점)
BUDGET_SWEET_SPOT_RATIO = 0.6

# 무드별 판정 키워드 (상품명·설명·색상군 텍스트에서 탐색)
MOOD_KEYWORDS: dict[str, tuple[str, ...]] = {
    "CASUAL": ("캐주얼", "데일리", "베이직", "casual", "daily", "basic"),
    "MINIMAL": ("미니멀", "심플", "무지", "solid", "minimal", "simple", "clean"),
    "STREET": ("스트릿", "오버사이즈", "빈티지", "street", "oversize", "vintage"),
    "CLASSIC": ("클래식", "포멀", "정장", "체크", "classic", "formal", "check"),
    "SPORTY": ("스포티", "액티브", "트레이닝", "sporty", "active", "training"),
    "ROMANTIC": ("로맨틱", "러블리", "플로럴", "레이스", "romantic", "lovely", "floral", "lace"),
}

# 무드와 어울리는 색상군 (색상 정보만 있어도 부분 점수를 준다)
MOOD_COLOR_GROUPS: dict[str, tuple[str, ...]] = {
    "CASUAL": ("BLUE", "WHITE", "GRAY", "BEIGE"),
    "MINIMAL": ("BLACK", "WHITE", "GRAY", "NAVY"),
    "STREET": ("BLACK", "GRAY", "GREEN"),
    "CLASSIC": ("NAVY", "BEIGE", "BROWN", "BLACK"),
    "SPORTY": ("WHITE", "BLACK", "RED", "BLUE"),
    "ROMANTIC": ("PINK", "IVORY", "WHITE", "PURPLE"),
}


def _searchable_text(candidate: RankCandidate) -> str:
    parts = [candidate.name, candidate.brand, candidate.description or ""]
    return " ".join(parts).lower()


def _mood_score(candidate: RankCandidate, moods: list[str]) -> float:
    """요청 무드 중 몇 개가 상품과 맞는지의 비율. 무드 미선택이면 중립값."""
    if not moods:
        return 0.5

    text = _searchable_text(candidate)
    color_group = (candidate.color_group or "").upper()

    total = 0.0
    for mood in moods:
        code = mood.upper()
        keywords = MOOD_KEYWORDS.get(code, ())
        if any(keyword.lower() in text for keyword in keywords):
            total += 1.0
            continue
        if color_group and color_group in MOOD_COLOR_GROUPS.get(code, ()):
            total += 0.5

    return min(total / len(moods), 1.0)


def _budget_score(price: int, budget_min: int, budget_max: int) -> float:
    """예산 구간 안에서 선호 지점에 가까울수록 높은 점수."""
    if budget_max <= budget_min:
        return 1.0

    band = budget_max - budget_min
    target = budget_min + BUDGET_SWEET_SPOT_RATIO * band
    # 선호 지점에서 구간 양 끝까지의 거리 중 먼 쪽을 기준으로 정규화
    span = max(target - budget_min, budget_max - target)
    if span <= 0:
        return 1.0

    score = 1.0 - abs(price - target) / span
    return max(0.0, min(1.0, score))


def _subcategory_score(candidate: RankCandidate, condition: RankCondition) -> float:
    """세부 분류 미지정이면 중립값, 지정했으면 일치 여부."""
    if not condition.subcategory:
        return 0.5
    return 1.0 if candidate.subcategory == condition.subcategory else 0.0


def _metadata_score(candidate: RankCandidate) -> float:
    """설명·색상군이 채워진 상품을 소폭 우대 (화면 품질)."""
    filled = 0
    if candidate.description:
        filled += 1
    if candidate.color_group:
        filled += 1
    return filled / 2


def score_candidate(candidate: RankCandidate, condition: RankCondition) -> float:
    total = (
        WEIGHT_MOOD * _mood_score(candidate, condition.moods)
        + WEIGHT_BUDGET * _budget_score(candidate.price, condition.budget_min, condition.budget_max)
        + WEIGHT_SUBCATEGORY * _subcategory_score(candidate, condition)
        + WEIGHT_METADATA * _metadata_score(candidate)
    )
    return round(total, 4)


def rank_candidates(request: RankRequest) -> RankResponse:
    """점수 내림차순, 동점이면 저가·낮은 id 순으로 확정한다."""
    scored = [
        (score_candidate(candidate, request.condition), candidate)
        for candidate in request.candidates
    ]
    scored.sort(key=lambda pair: (-pair[0], pair[1].price, pair[1].product_id))

    ranked = [
        RankedProduct(product_id=candidate.product_id, rank=index, score=score)
        for index, (score, candidate) in enumerate(scored[: request.limit], start=1)
    ]

    return RankResponse(schema_version=SCHEMA_VERSION, ranked=ranked)
