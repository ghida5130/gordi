package com.ssafy.backend.recommendation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.util.List;

// 추천 생성 요청 (필드 형식 검증은 DTO Validation 으로 처리)
public record RecommendationRequest(

        @NotBlank
        String category,

        String subcategory,

        @NotNull
        @PositiveOrZero
        Integer budgetMin,

        @NotNull
        @PositiveOrZero
        Integer budgetMax,

        @NotNull
        @Size(min = 1, max = 5)
        List<@NotBlank String> moods
) {
}
