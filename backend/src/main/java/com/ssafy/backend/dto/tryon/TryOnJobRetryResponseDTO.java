package com.ssafy.backend.dto.tryon;

import java.time.Instant;

/** POST /api/v1/try-on-jobs/{jobId}/retry 응답 (202 ACCEPTED). 원본 Job 은 그대로 두고 새 Job 을 만든다. */
public record TryOnJobRetryResponseDTO(
        Long jobId,
        Long retryOfJobId,
        String status,
        boolean cacheHit,
        Instant createdAt
) {
}
