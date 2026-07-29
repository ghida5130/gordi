package com.ssafy.backend.recommendation.domain;

// status=EMPTY 인 추천 스냅샷의 사유
public enum EmptyReason {

    // 조건에 맞는 상품이 있으나 예산 범위를 벗어남
    NO_PRODUCT_IN_BUDGET,

    // 카테고리/세부 분류 자체에 판매 가능한 상품이 없음
    NO_PRODUCT_IN_CATEGORY,

    // 이미 노출된 상품을 제외하면 남은 후보가 없음 (재추천)
    NO_CANDIDATE_LEFT
}
