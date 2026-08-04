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

    /** 생성 서비스가 Job 을 잃어버려 Spring 이 마감했음을 뜻한다(생성 서비스가 보낸 코드와 구분). */
    static final String ORPHAN_ERROR_CODE = "GENERATION_LOST";

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
            return closeIfOrphaned(job);
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

    /* ==================== 고아 Job 마감 ==================== */

    /**
     * 생성 서비스가 Job 을 모른다고 답했을 때의 처리.
     * <p>
     * "모른다"는 두 가지를 뜻한다.
     * <ul>
     *   <li>접수 직후라 아직 등록되지 않았다 — 곧 정상 처리된다</li>
     *   <li>생성 서비스가 재시작해 진행 중이던 Job 이 사라졌다 — 콜백이 영원히 오지 않는다</li>
     * </ul>
     * 앞의 경우를 실패로 만들면 정상 Job 을 죽이므로, 생성 후 충분히 지난 Job 만 마감한다.
     * 마감하지 않으면 QUEUED 로 영구히 남고, 재시도는 FAILED 만 허용하므로 사용자가 빠져나갈 길이 없다.
     * <p>
     * 원인이 생성 서비스 유실이라 다시 요청하면 성공할 수 있으므로 재시도 가능으로 마감한다.
     */
    private boolean closeIfOrphaned(TryOnJob job) {
        LocalDateTime createdAt = job.getCreatedAt();
        LocalDateTime deadline = LocalDateTime.now(AppZone.KST)
                .minus(Duration.ofMillis(tryOnPolicy.getReconcileOrphanAfterMs()));

        if (createdAt == null || createdAt.isAfter(deadline)) {
            // 아직 유예 기간 안이다. 다음 주기에 다시 확인한다.
            log.warn("Try-on job unknown to generation service. jobId={}", job.getId());
            return false;
        }

        job.markFailed(
                ORPHAN_ERROR_CODE,
                "착장 이미지 생성 기록을 찾을 수 없습니다. 다시 시도해 주세요.",
                true,
                LocalDateTime.now(AppZone.KST)
        );
        log.warn("Closed orphaned try-on job. jobId={}, createdAt={}", job.getId(), createdAt);
        return true;
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
