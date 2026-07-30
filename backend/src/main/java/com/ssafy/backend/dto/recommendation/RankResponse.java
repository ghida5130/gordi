package com.ssafy.backend.dto.recommendation;

import java.util.List;

// POST /internal/v1/recommendations/rank 응답
public record RankResponse(
        String schemaVersion,
        List<RankedProduct> ranked
) {
}
