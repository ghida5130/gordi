package com.ssafy.backend.infra;

import com.ssafy.backend.config.RecommendationRankCacheProperties;
import com.ssafy.backend.dto.recommendation.RankedProduct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Component
public class RedisRecommendationRankCache {

    private static final Logger log = LoggerFactory.getLogger(RedisRecommendationRankCache.class);
    private static final int PAYLOAD_FORMAT_VERSION = 1;

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final RecommendationRankCacheProperties properties;

    public RedisRecommendationRankCache(
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            RecommendationRankCacheProperties properties
    ) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    public Optional<List<RankedProduct>> get(
            String key,
            Set<Long> candidateProductIds,
            int limit
    ) {
        if (!properties.isEnabled()) {
            return Optional.empty();
        }

        String serialized;
        try {
            serialized = redisTemplate.opsForValue().get(key);
        } catch (RuntimeException exception) {
            log.warn(
                    "Recommendation rank cache read failed. cacheKey={}, exceptionType={}",
                    keyTag(key),
                    exception.getClass().getName()
            );
            return Optional.empty();
        }

        if (serialized == null) {
            log.debug("Recommendation rank cache miss. cacheKey={}", keyTag(key));
            return Optional.empty();
        }

        try {
            CachePayload payload = objectMapper.readValue(serialized, CachePayload.class);
            Optional<List<RankedProduct>> validated = validate(payload, candidateProductIds, limit);
            if (validated.isEmpty()) {
                evictInvalid(key, "validation_failed");
                return Optional.empty();
            }

            log.debug("Recommendation rank cache hit. cacheKey={}", keyTag(key));
            return validated;
        } catch (Exception exception) {
            log.warn(
                    "Recommendation rank cache payload could not be restored. cacheKey={}, exceptionType={}",
                    keyTag(key),
                    exception.getClass().getName()
            );
            evictInvalid(key, "deserialization_failed");
            return Optional.empty();
        }
    }

    public void put(
            String key,
            List<RankedProduct> ranked,
            Set<Long> candidateProductIds,
            int limit
    ) {
        if (!properties.isEnabled()) {
            return;
        }

        CachePayload payload = new CachePayload(PAYLOAD_FORMAT_VERSION, ranked);
        Optional<List<RankedProduct>> validated = validate(payload, candidateProductIds, limit);
        if (validated.isEmpty()) {
            log.warn("Recommendation rank result was not cached because it was invalid. cacheKey={}", keyTag(key));
            return;
        }

        try {
            String serialized = objectMapper.writeValueAsString(
                    new CachePayload(PAYLOAD_FORMAT_VERSION, validated.get())
            );
            redisTemplate.opsForValue().set(key, serialized, properties.getTtl());
        } catch (Exception exception) {
            log.warn(
                    "Recommendation rank cache write failed. cacheKey={}, exceptionType={}",
                    keyTag(key),
                    exception.getClass().getName()
            );
        }
    }

    private Optional<List<RankedProduct>> validate(
            CachePayload payload,
            Set<Long> candidateProductIds,
            int limit
    ) {
        if (payload == null
                || payload.formatVersion() != PAYLOAD_FORMAT_VERSION
                || payload.ranked() == null
                || payload.ranked().isEmpty()
                || payload.ranked().size() > limit
                || payload.ranked().size() > candidateProductIds.size()) {
            return Optional.empty();
        }

        List<RankedProduct> sorted = new ArrayList<>(payload.ranked());
        if (sorted.stream().anyMatch(item -> item == null || item.rank() == null)) {
            return Optional.empty();
        }
        sorted.sort((left, right) -> Integer.compare(left.rank(), right.rank()));

        Set<Long> uniqueProductIds = new HashSet<>();
        for (int index = 0; index < sorted.size(); index++) {
            RankedProduct item = sorted.get(index);
            if (item.productId() == null
                    || item.rank() != index + 1
                    || item.score() == null
                    || item.score().compareTo(BigDecimal.ZERO) < 0
                    || item.score().compareTo(BigDecimal.ONE) > 0
                    || !candidateProductIds.contains(item.productId())
                    || !uniqueProductIds.add(item.productId())) {
                return Optional.empty();
            }
        }
        return Optional.of(List.copyOf(sorted));
    }

    private void evictInvalid(String key, String reason) {
        try {
            redisTemplate.delete(key);
            log.debug(
                    "Invalid recommendation rank cache entry was evicted. cacheKey={}, reason={}",
                    keyTag(key),
                    reason
            );
        } catch (RuntimeException exception) {
            log.warn(
                    "Invalid recommendation rank cache entry could not be evicted. cacheKey={}, exceptionType={}",
                    keyTag(key),
                    exception.getClass().getName()
            );
        }
    }

    private String keyTag(String key) {
        int separator = key.lastIndexOf(':');
        String hash = separator < 0 ? key : key.substring(separator + 1);
        return hash.substring(0, Math.min(hash.length(), 12));
    }

    private record CachePayload(int formatVersion, List<RankedProduct> ranked) {
    }
}
