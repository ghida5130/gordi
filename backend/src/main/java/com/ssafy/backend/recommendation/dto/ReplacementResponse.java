package com.ssafy.backend.recommendation.dto;

import java.util.List;

// 선택 상품 재추천 응답 (새 버전 스냅샷 + 교체 내역)
public record ReplacementResponse(
        Long recommendationId,
        String status,
        Long version,
        List<RecommendationItemResponse> items,
        List<ReplacedItemResponse> replaced,
        List<Long> unreplacedProductIds
) {
}
