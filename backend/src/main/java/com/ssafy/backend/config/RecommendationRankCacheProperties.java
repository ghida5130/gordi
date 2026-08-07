package com.ssafy.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.Duration;

@Component
public class RecommendationRankCacheProperties {

    private final boolean enabled;
    private final Duration ttl;
    private final String keyVersion;
    private final String rankerRevision;

    public RecommendationRankCacheProperties(
            @Value("${gordi.recommendation.rank-cache.enabled:true}") boolean enabled,
            @Value("${gordi.recommendation.rank-cache.ttl:30m}") Duration ttl,
            @Value("${gordi.recommendation.rank-cache.key-version:v1}") String keyVersion,
            @Value("${gordi.recommendation.rank-cache.ranker-revision:2.0}") String rankerRevision
    ) {
        if (ttl == null || ttl.isZero() || ttl.isNegative()) {
            throw new IllegalArgumentException("Recommendation rank cache TTL must be positive.");
        }
        if (!StringUtils.hasText(keyVersion)) {
            throw new IllegalArgumentException("Recommendation rank cache key version must not be blank.");
        }
        if (!StringUtils.hasText(rankerRevision)) {
            throw new IllegalArgumentException("Recommendation ranker revision must not be blank.");
        }

        this.enabled = enabled;
        this.ttl = ttl;
        this.keyVersion = keyVersion;
        this.rankerRevision = rankerRevision;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public Duration getTtl() {
        return ttl;
    }

    public String getKeyVersion() {
        return keyVersion;
    }

    public String getRankerRevision() {
        return rankerRevision;
    }
}
