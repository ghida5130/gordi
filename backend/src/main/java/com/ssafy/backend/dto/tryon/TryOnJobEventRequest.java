package com.ssafy.backend.dto.tryon;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

/**
 * POST /internal/v1/try-on-jobs/{jobId}/events 요청.
 * <p>
 * eventType 별 필수 항목(SUCCEEDED 는 result, FAILED 는 error)은 서로 다른 필드를 함께 봐야 하므로
 * Service 에서 검증한다.
 */
public record TryOnJobEventRequest(

        @NotBlank @Size(max = 64) String eventId,

        @NotNull @PositiveOrZero Long sequence,

        // PROCESSING / SUCCEEDED / FAILED
        @NotBlank String eventType,

        // 외부 생성 서비스의 내부 시도 횟수
        Integer attempt,

        @Valid Result result,

        Boolean cacheHit,

        @Valid Error error,

        String modelVersion,

        String promptVersion,

        Instant occurredAt
) {

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
