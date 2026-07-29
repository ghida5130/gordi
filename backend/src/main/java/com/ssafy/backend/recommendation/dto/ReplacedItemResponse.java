package com.ssafy.backend.recommendation.dto;

// 교체된 상품 한 건 (position 은 교체가 일어난 순위)
public record ReplacedItemResponse(
        Long oldProductId,
        Long newProductId,
        Integer position
) {
}
