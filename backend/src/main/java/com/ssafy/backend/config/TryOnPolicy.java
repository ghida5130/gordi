package com.ssafy.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 착장 이미지 생성 정책 단일 출처.
 * 생성 한도와 폴링 간격은 프론트엔드가 하드코딩하지 않고 응답값을 사용한다.
 */
@Component
public class TryOnPolicy {

    private final int dailyLimit;
    private final long pollAfterMs;
    private final int maxItems;
    private final long reconcileStaleAfterMs;
    private final int reconcileBatchSize;
    private final long reconcileOrphanAfterMs;

    public TryOnPolicy(
            @Value("${gordi.try-on.daily-limit:20}") int dailyLimit,
            @Value("${gordi.try-on.poll-after-ms:1500}") long pollAfterMs,
            @Value("${gordi.try-on.max-items:5}") int maxItems,
            @Value("${gordi.try-on.reconcile.stale-after-ms:120000}") long reconcileStaleAfterMs,
            @Value("${gordi.try-on.reconcile.batch-size:20}") int reconcileBatchSize,
            @Value("${gordi.try-on.reconcile.orphan-after-ms:600000}") long reconcileOrphanAfterMs
    ) {
        this.dailyLimit = dailyLimit;
        this.pollAfterMs = pollAfterMs;
        this.maxItems = maxItems;
        this.reconcileStaleAfterMs = reconcileStaleAfterMs;
        this.reconcileBatchSize = reconcileBatchSize;
        this.reconcileOrphanAfterMs = reconcileOrphanAfterMs;
    }

    // 요청자 1인당 1일 생성 한도 (초과 시 GENERATION_QUOTA_EXCEEDED)
    public int getDailyLimit() {
        return dailyLimit;
    }

    // 등록 응답의 권장 폴링 지연
    public long getPollAfterMs() {
        return pollAfterMs;
    }

    // 한 Job 에 포함할 수 있는 착장 아이템 상한
    public int getMaxItems() {
        return maxItems;
    }

    // 이 시간이 지나도 끝나지 않은 Job 은 콜백이 유실된 것으로 보고 조회한다.
    public long getReconcileStaleAfterMs() {
        return reconcileStaleAfterMs;
    }

    // 정합 복구 1회 실행에서 처리할 Job 상한
    public int getReconcileBatchSize() {
        return reconcileBatchSize;
    }

    /**
     * 생성 서비스가 Job 을 모른다고 답한 채 이 시간이 지나면 실패로 마감한다.
     * <p>
     * 접수 직후에는 생성 서비스가 아직 Job 을 등록하지 않아 잠깐 모른다고 답할 수 있으므로,
     * 그 찰나와 구분되도록 stale-after 보다 넉넉하게 둔다.
     */
    public long getReconcileOrphanAfterMs() {
        return reconcileOrphanAfterMs;
    }
}
