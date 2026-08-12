package com.ssafy.backend.scheduler;

import com.ssafy.backend.repository.RefreshRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;

// refresh JWT 수명이 지난 행은 서명 검증 단계에서 이미 거부되므로 재사용 감지 가치가 없다.
// 그 이후의 행만 지워 테이블 크기를 유지한다 (soft-rotate 도입으로 행이 삭제되지 않고 쌓이기 때문)
@Slf4j
@Component
public class RefreshTokenCleanupScheduler {

    private final RefreshRepository refreshRepository;
    private final long refreshExpirationMs;

    public RefreshTokenCleanupScheduler(
            RefreshRepository refreshRepository,
            @Value("${jwt.refresh-token-expiration}") long refreshExpirationMs
    ) {
        this.refreshRepository = refreshRepository;
        this.refreshExpirationMs = refreshExpirationMs;
    }

    @Scheduled(fixedDelayString = "${auth.refresh.cleanup-interval-ms:3600000}")
    @Transactional
    public void purgeExpiredTokens() {
        LocalDateTime cutoff = LocalDateTime.now().minus(Duration.ofMillis(refreshExpirationMs));
        refreshRepository.deleteByCreatedDateBefore(cutoff);
    }
}