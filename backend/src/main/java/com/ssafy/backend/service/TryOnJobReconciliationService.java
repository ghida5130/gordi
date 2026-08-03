package com.ssafy.backend.service;

import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.config.TryOnPolicy;
import com.ssafy.backend.config.enums.TryOnJobStatus;
import com.ssafy.backend.domain.TryOnJob;
import com.ssafy.backend.dto.tryon.TryOnJobStatusResponse;
import com.ssafy.backend.infra.TryOnGenerationClient;
import com.ssafy.backend.repository.TryOnJobRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 콜백 유실 복구.
 * <p>
 * 정상 경로에서는 생성 서비스가 보낸 이벤트로 Job 이 종료 상태가 된다.
 * 그 콜백이 유실되면 Job 이 QUEUED/RUNNING 에 영원히 남으므로,
 * 일정 시간이 지난 Job 만 골라 생성 서비스에 실제 상태를 물어 보정한다.
 * <p>
 * Job 하나의 실패가 나머지를 막지 않도록 트랜잭션 경계를 Job 단위로 둔다.
 */
@Service
@RequiredArgsConstructor
public class TryOnJobReconciliationService {

    private static final Logger log = LoggerFactory.getLogger(TryOnJobReconciliationService.class);

    private final TryOnJobRepository tryOnJobRepository;
    private final TryOnGenerationClient tryOnGenerationClient;
    private final TryOnPolicy tryOnPolicy;

    /** 콜백이 오지 않은 채 오래 머문 Job 목록 */
    @Transactional(readOnly = true)
    public List<Long> findStaleJobIds() {
        LocalDateTime threshold = LocalDateTime.now(AppZone.KST)
                .minus(Duration.ofMillis(tryOnPolicy.getReconcileStaleAfterMs()));

        return tryOnJobRepository.findStaleJobIds(
                threshold,
                PageRequest.of(0, tryOnPolicy.getReconcileBatchSize())
        );
    }

    /**
     * Job 하나를 생성 서비스의 실제 상태로 보정한다.
     *
     * @return 종료 상태로 보정했으면 true
     */
    @Transactional
    public boolean reconcile(Long jobId) {
        TryOnJob job = tryOnJobRepository.findById(jobId).orElse(null);
        if (job == null) {
            return false;
        }
        // 조회를 준비하는 사이에 콜백이 도착했을 수 있다.
        if (job.resolveStatus().isTerminal()) {
            return false;
        }

        Optional<TryOnJobStatusResponse.Data> fetched = tryOnGenerationClient.fetchStatus(jobId);
        if (fetched.isEmpty()) {
            // 생성 서비스가 Job 을 모른다 = 접수가 유실됐다. 상태를 함부로 바꾸지 않고 남겨 둔다.
            log.warn("Try-on job unknown to generation service. jobId={}", jobId);
            return false;
        }

        TryOnJobStatusResponse.Data status = fetched.get();
        TryOnJobStatus resolved = parseStatus(status.status());
        if (resolved == null || !resolved.isTerminal()) {
            // 아직 처리 중. 다음 주기에 다시 확인한다.
            return false;
        }

        applyMeta(job, status);
        if (resolved.isSucceeded()) {
            return applySucceeded(job, status);
        }
        return applyFailed(job, status);
    }

    /* ==================== 반영 ==================== */

    private void applyMeta(TryOnJob job, TryOnJobStatusResponse.Data status) {
        if (status.attempt() != null) {
            job.setAttempt(status.attempt());
        }
        if (status.cacheHit() != null) {
            job.setCacheHit(status.cacheHit());
        }
    }

    private boolean applySucceeded(TryOnJob job, TryOnJobStatusResponse.Data status) {
        TryOnJobStatusResponse.Result result = status.result();
        if (result == null) {
            log.warn("SUCCEEDED status without result. jobId={}", job.getId());
            return false;
        }

        job.markSucceeded(
                result.imageUrl(),
                result.width(),
                result.height(),
                result.fitSummary(),
                result.disclaimer(),
                status.modelVersion(),
                status.promptVersion(),
                toLocalDateTime(status.completedAt())
        );
        log.info("Recovered try-on job by reconciliation. jobId={}, status=SUCCEEDED", job.getId());
        return true;
    }

    private boolean applyFailed(TryOnJob job, TryOnJobStatusResponse.Data status) {
        TryOnJobStatusResponse.Error error = status.error();
        if (error == null) {
            log.warn("FAILED status without error. jobId={}", job.getId());
            return false;
        }

        job.markFailed(
                error.code(),
                error.message(),
                error.retryable(),
                toLocalDateTime(status.completedAt())
        );
        job.setModelVersion(status.modelVersion());
        job.setPromptVersion(status.promptVersion());
        log.info("Recovered try-on job by reconciliation. jobId={}, status=FAILED", job.getId());
        return true;
    }

    /* ==================== 변환 ==================== */

    // 모르는 상태 문자열은 보정 대상에서 제외한다.
    private TryOnJobStatus parseStatus(String status) {
        try {
            return TryOnJobStatus.valueOf(status);
        } catch (IllegalArgumentException | NullPointerException exception) {
            log.warn("Unknown try-on status from generation service. status={}", status);
            return null;
        }
    }

    private LocalDateTime toLocalDateTime(Instant completedAt) {
        Instant resolved = completedAt == null ? Instant.now() : completedAt;
        return LocalDateTime.ofInstant(resolved, AppZone.KST);
    }
}
