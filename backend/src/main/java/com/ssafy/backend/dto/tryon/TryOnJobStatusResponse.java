package com.ssafy.backend.dto.tryon;

import java.time.Instant;
import java.util.List;

/**
 * GET /internal/v1/try-on-jobs/{jobId} 응답 (외부 생성 서비스 조회 계약).
 * 콜백이 유실됐을 때 정합 복구 worker 만 사용한다.
 */
public record TryOnJobStatusResponse(Data data) {

    public record Data(
            Long jobId,
            String status,
            Integer attempt,
            Boolean cacheHit,
            Result result,
            Error error,
            String modelVersion,
            String promptVersion,
            Instant createdAt,
            Instant completedAt
    ) {
    }

    public record Result(
            String imageUrl,
            Integer width,
            Integer height,
            List<String> fitSummary,
            String disclaimer
    ) {
    }

    public record Error(
            String code,
            String message,
            boolean retryable
    ) {
    }
}
