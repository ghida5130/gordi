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

    public TryOnPolicy(
            @Value("${gordi.try-on.daily-limit:20}") int dailyLimit,
            @Value("${gordi.try-on.poll-after-ms:1500}") long pollAfterMs,
            @Value("${gordi.try-on.max-items:5}") int maxItems
    ) {
        this.dailyLimit = dailyLimit;
        this.pollAfterMs = pollAfterMs;
        this.maxItems = maxItems;
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
}
