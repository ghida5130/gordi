package com.ssafy.backend.dto.recommendation;

import com.ssafy.backend.domain.Recommendation;

import java.util.List;

// 추천 스냅샷이 생성될 때 사용된 조건
public record RecommendationConditionResponse(
        String category,
        String subcategory,
        Integer budgetMin,
        Integer budgetMax,
        List<String> moods
) {

    public static RecommendationConditionResponse of(Recommendation recommendation, List<String> moods) {
        return new RecommendationConditionResponse(
                recommendation.getCategory(),
                recommendation.getSubcategory(),
                recommendation.getBudgetMin(),
                recommendation.getBudgetMax(),
                moods
        );
    }
}
