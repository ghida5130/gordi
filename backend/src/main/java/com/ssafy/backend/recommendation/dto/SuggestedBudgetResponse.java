package com.ssafy.backend.recommendation.dto;

import com.ssafy.backend.recommendation.domain.Recommendation;

// 결과가 없을 때 제안하는 예산 범위 (자동 적용하지 않고 안내만 한다)
public record SuggestedBudgetResponse(Integer budgetMin, Integer budgetMax) {

    // 제안 값이 없으면 null 을 반환해 응답에서 그대로 null 로 노출
    public static SuggestedBudgetResponse from(Recommendation recommendation) {
        Integer min = recommendation.getSuggestedBudgetMin();
        Integer max = recommendation.getSuggestedBudgetMax();

        if (min == null && max == null) {
            return null;
        }
        return new SuggestedBudgetResponse(min, max);
    }
}
