package com.ssafy.backend.dto.recommendation;

import java.util.List;

// FastAPI 순위 계산 기준 조건
public record RankCondition(
        String category,
        String subcategory,
        Integer budgetMin,
        Integer budgetMax,
        List<String> moods
) {
}
