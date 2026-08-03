package com.ssafy.backend.dto.tryon;

import java.time.Instant;

/** POST /api/v1/try-on-jobs 응답 (202 ACCEPTED). 결과는 조회 API 로 폴링한다. */
public record TryOnJobCreateResponseDTO(
        Long jobId,
        String status,
        boolean cacheHit,
        long pollAfterMs,
        Instant createdAt
) {
}
