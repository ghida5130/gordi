package com.ssafy.backend.recommendation.dto.ai;

import java.math.BigDecimal;

// FastAPI 가 매긴 상품 순위 한 건
public record RankedProduct(
        Long productId,
        Integer rank,
        BigDecimal score
) {
}
