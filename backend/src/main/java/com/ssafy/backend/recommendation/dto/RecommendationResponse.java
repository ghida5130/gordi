package com.ssafy.backend.recommendation.dto;

import com.ssafy.backend.recommendation.domain.Recommendation;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

// 추천 스냅샷 응답 (생성 / 조회 공통 구조)
public record RecommendationResponse(
        Long recommendationId,
        String status,
        Long version,
        RecommendationConditionResponse condition,
        List<RecommendationItemResponse> items,
        String emptyReason,
        SuggestedBudgetResponse suggestedBudget,
        Instant createdAt
) {

    public static RecommendationResponse of(
            Recommendation recommendation,
            List<String> moods,
            List<RecommendationItemResponse> items
    ) {
        return new RecommendationResponse(
                recommendation.getId(),
                recommendation.getStatus(),
                recommendation.getVersion(),
                RecommendationConditionResponse.of(recommendation, moods),
                items,
                recommendation.getEmptyReason(),
                SuggestedBudgetResponse.from(recommendation),
                toInstant(recommendation.getCreatedAt())
        );
    }

    private static Instant toInstant(java.time.LocalDateTime createdAt) {
        return createdAt == null ? null : createdAt.atZone(ZoneId.systemDefault()).toInstant();
    }
}
