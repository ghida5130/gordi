package com.ssafy.backend.dto.recommendation;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.List;

// 선택 상품 재추천 요청
public record ReplacementRequest(

        @NotNull
        @Positive
        Long baseVersion,

        @NotEmpty
        List<@NotNull @Positive Long> productIds
) {
}
