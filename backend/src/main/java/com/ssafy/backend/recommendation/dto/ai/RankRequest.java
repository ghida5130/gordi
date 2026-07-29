package com.ssafy.backend.recommendation.dto.ai;

import java.util.List;

// POST /internal/v1/recommendations/rank 요청
public record RankRequest(
        Long recommendationId,
        RankCondition condition,
        int limit,
        List<RankCandidate> candidates
) {
}
