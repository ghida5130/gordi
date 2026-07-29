package com.ssafy.backend.dto.recommendation;

import java.math.BigDecimal;

// FastAPI 가 매긴 상품 순위 한 건
public record RankedProduct(
        Long productId,
        Integer rank,
        BigDecimal score
) {
}
