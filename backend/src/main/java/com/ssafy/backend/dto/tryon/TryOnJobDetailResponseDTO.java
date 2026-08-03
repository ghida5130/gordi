package com.ssafy.backend.dto.tryon;

import java.time.Instant;
import java.util.List;

/**
 * GET /api/v1/try-on-jobs/{jobId} 응답.
 * 실패한 Job 도 HTTP 200 으로 반환하며 status=FAILED 와 error 로 원인을 노출한다.
 */
public record TryOnJobDetailResponseDTO(
        Long jobId,
        String status,
        boolean cacheHit,
        // 성공 전에는 null
        Result result,
        // 실패가 아니면 null
        Error error,
        String modelVersion,
        String promptVersion,
        Instant createdAt,
        Instant completedAt
) {

    public record Result(
            String imageUrl,
            Integer width,
            Integer height,
            List<String> fitSummary,
            String disclaimer
    ) {
    }

    /** retryable 이 true 인 실패만 재시도 API 로 새 Job 을 만들 수 있다. */
    public record Error(
            String code,
            String message,
            boolean retryable
    ) {
    }
}
