package com.ssafy.backend.service;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 정합 복구 주기 실행.
 * <p>
 * 트랜잭션을 열지 않고 대상만 모은 뒤 Job 하나씩 {@link TryOnJobReconciliationService#reconcile}
 * 에 위임한다. 한 Job 의 실패(생성 서비스 통신 오류 등)가 나머지 Job 처리를 막지 않는다.
 */
@Component
@ConditionalOnProperty(
        name = "gordi.try-on.reconcile.enabled",
        havingValue = "true",
        matchIfMissing = true
)
@RequiredArgsConstructor
public class TryOnJobReconciliationScheduler {

    private static final Logger log = LoggerFactory.getLogger(TryOnJobReconciliationScheduler.class);

    private final TryOnJobReconciliationService tryOnJobReconciliationService;

    @Scheduled(
            fixedDelayString = "${gordi.try-on.reconcile.interval-ms:30000}",
            initialDelayString = "${gordi.try-on.reconcile.interval-ms:30000}"
    )
    public void reconcileStaleJobs() {
        List<Long> staleJobIds = tryOnJobReconciliationService.findStaleJobIds();
        if (staleJobIds.isEmpty()) {
            return;
        }

        int recovered = 0;
        for (Long jobId : staleJobIds) {
            try {
                if (tryOnJobReconciliationService.reconcile(jobId)) {
                    recovered++;
                }
            } catch (Exception exception) {
                log.warn(
                        "Try-on reconciliation failed for one job. jobId={}, exceptionType={}",
                        jobId,
                        exception.getClass().getName()
                );
            }
        }

        log.info("Try-on reconciliation finished. checked={}, recovered={}", staleJobIds.size(), recovered);
    }
}
