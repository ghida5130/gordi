package com.ssafy.backend.domain;

// 상품 판매 상태
public enum ProductAvailability {

    // 추천 후보로 사용 가능
    AVAILABLE,

    // 일시 품절
    SOLD_OUT,

    // 판매 종료
    DISCONTINUED
}
