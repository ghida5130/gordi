package com.ssafy.backend.service;

import com.ssafy.backend.common.aop.BusinessOperation;
import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.config.enums.TryOnJobEventType;
import com.ssafy.backend.domain.TryOnJob;
import com.ssafy.backend.domain.TryOnJobEvent;
import com.ssafy.backend.dto.tryon.TryOnJobEventRequest;
import com.ssafy.backend.repository.TryOnJobEventRepository;
import com.ssafy.backend.repository.TryOnJobRepository;
import com.ssafy.backend.websocket.event.TryOnFailedEvent;
import com.ssafy.backend.websocket.event.TryOnSucceededEvent;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * 외부 생성 서비스가 보내는 착장 Job 상태 콜백 처리.
 * <p>
 * 전송 측은 timeout 과 5xx 에서 재전송하므로 같은 이벤트가 여러 번 도착할 수 있다.
 * 두 가지 방어를 둔다.
 * <ul>
 *   <li>중복: 같은 {@code (jobId, eventId)} 는 상태를 바꾸지 않고 그대로 성공 처리한다.</li>
 *   <li>역전: {@code sequence} 가 이미 반영한 값보다 낮거나 같으면 늦게 도착한 것으로 보고 무시한다.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Transactional
public class TryOnJobEventService {

    private static final Logger log = LoggerFactory.getLogger(TryOnJobEventService.class);

    private final TryOnJobRepository tryOnJobRepository;
    private final TryOnJobEventRepository tryOnJobEventRepository;
    private final ApplicationEventPublisher eventPublisher;

    @BusinessOperation(value = "tryon.job.event.apply", slowThresholdMs = 1_000)
    public void apply(Long jobId, TryOnJobEventRequest request) {
        TryOnJobEventType eventType = parseEventType(request.eventType());

        TryOnJob job = tryOnJobRepository.findById(jobId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND, Map.of("jobId", jobId)));

        // 동일 중복 재전송 시 500 -> 예외 잡아서 중복 간주 (204) 처리
        if (tryOnJobEventRepository.existsByTryOnJobIdAndEventId(jobId, request.eventId())) {
            log.info("Duplicate try-on event ignored. jobId={}, eventId={}", jobId, request.eventId());
            return;
        }

        // 무시하는 이벤트도 기록해 두어야 재전송 시 같은 판정을 반복할 수 있다.
        tryOnJobEventRepository.save(TryOnJobEvent.builder()
                .tryOnJob(job)
                .eventId(request.eventId())
                .sequence(request.sequence())
                .eventType(eventType.name())
                .build());

        if (isStale(job, request.sequence())) {
            log.info(
                    "Out-of-order try-on event ignored. jobId={}, sequence={}, lastSequence={}",
                    jobId, request.sequence(), job.getLastEventSequence()
            );
            return;
        }

        job.setLastEventSequence(request.sequence());
        if (request.attempt() != null) {
            job.setAttempt(request.attempt());
        }
        if (request.cacheHit() != null) {
            job.setCacheHit(request.cacheHit());
        }

        switch (eventType) {
            case PROCESSING -> markRunning(job);
            case SUCCEEDED -> markSucceeded(job, request);
            case FAILED -> markFailed(job, request);
        }
    }

    /* ==================== 상태 전이 ==================== */

    // 이미 끝난 Job 을 되돌리지 않는다.
    private void markRunning(TryOnJob job) {
        if (job.resolveStatus().isTerminal()) {
            log.info("PROCESSING event on terminal job ignored. jobId={}, status={}", job.getId(), job.getStatus());
            return;
        }
        job.markRunning();
    }

    private void markSucceeded(TryOnJob job, TryOnJobEventRequest request) {
        TryOnJobEventRequest.Result result = request.result();
        if (result == null) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "SUCCEEDED 이벤트에는 result 가 필요합니다.");
        }

        job.markSucceeded(
                result.imageUrl(),
                result.width(),
                result.height(),
                result.fitSummary(),
                result.disclaimer(),
                request.modelVersion(),
                request.promptVersion(),
                toLocalDateTime(request.occurredAt())
        );
        publishSucceededIfRoom(job);
    }

    private void markFailed(TryOnJob job, TryOnJobEventRequest request) {
        TryOnJobEventRequest.Error error = request.error();
        if (error == null) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "FAILED 이벤트에는 error 가 필요합니다.");
        }

        job.markFailed(
                error.code(),
                error.message(),
                error.retryable(),
                toLocalDateTime(request.occurredAt())
        );
        job.setModelVersion(request.modelVersion());
        job.setPromptVersion(request.promptVersion());
        publishFailedIfRoom(job);
    }

    /* ==================== 변환 ==================== */

    private TryOnJobEventType parseEventType(String eventType) {
        try {
            return TryOnJobEventType.valueOf(eventType);
        } catch (IllegalArgumentException exception) {
            throw new ApiException(ErrorCode.BAD_REQUEST, Map.of("eventType", eventType));
        }
    }

    private boolean isStale(TryOnJob job, Long sequence) {
        Long last = job.getLastEventSequence();
        return last != null && sequence <= last;
    }

    private void publishSucceededIfRoom(TryOnJob job) {
        if (!job.resolveContextType().isRoom() || job.getRoom() == null) {
            return;
        }

        eventPublisher.publishEvent(new TryOnSucceededEvent(
                job.getRoom().getId(),
                job.getRoom().getVersion(),
                job.getOwnerParticipant() == null ? null : job.getOwnerParticipant().getId(),
                job.getId(),
                job.getResultImageUrl()
        ));
    }

    private void publishFailedIfRoom(TryOnJob job) {
        if (!job.resolveContextType().isRoom() || job.getRoom() == null) {
            return;
        }

        eventPublisher.publishEvent(new TryOnFailedEvent(
                job.getRoom().getId(),
                job.getRoom().getVersion(),
                job.getOwnerParticipant() == null ? null : job.getOwnerParticipant().getId(),
                job.getId(),
                job.getErrorMessage()
        ));
    }

    // 발신 시각이 없으면 수신 시각을 사용한다.
    private LocalDateTime toLocalDateTime(Instant occurredAt) {
        Instant resolved = occurredAt == null ? Instant.now() : occurredAt;
        return LocalDateTime.ofInstant(resolved, AppZone.KST);
    }
}
