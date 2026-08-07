package com.ssafy.backend.infra;

import com.ssafy.backend.config.RecommendationRankCacheProperties;
import com.ssafy.backend.dto.recommendation.RankedProduct;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RedisRecommendationRankCacheTest {

    private static final String KEY = "gordi:rec:rank:v1:abcdef";

    @Mock
    private StringRedisTemplate redisTemplate;
    @Mock
    private ValueOperations<String, String> valueOperations;

    private RedisRecommendationRankCache cache;

    @BeforeEach
    void setUp() {
        RecommendationRankCacheProperties properties = new RecommendationRankCacheProperties(
                true,
                Duration.ofMinutes(30),
                "v1",
                "2.0"
        );
        cache = new RedisRecommendationRankCache(redisTemplate, new ObjectMapper(), properties);
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
    }

    @Test
    void getReturnsValidatedRankingSortedByRank() {
        when(valueOperations.get(KEY)).thenReturn("""
                {
                  "formatVersion": 1,
                  "ranked": [
                    {"productId": 102, "rank": 2, "score": 0.7100},
                    {"productId": 101, "rank": 1, "score": 0.8600}
                  ]
                }
                """);

        Optional<List<RankedProduct>> found = cache.get(KEY, Set.of(101L, 102L), 10);

        assertThat(found).isPresent();
        assertThat(found.get())
                .extracting(RankedProduct::productId)
                .containsExactly(101L, 102L);
        verify(redisTemplate, never()).delete(KEY);
    }

    @Test
    void getEvictsRankingWhenCachedProductIsNotCurrentCandidate() {
        when(valueOperations.get(KEY)).thenReturn("""
                {
                  "formatVersion": 1,
                  "ranked": [
                    {"productId": 999, "rank": 1, "score": 0.8600}
                  ]
                }
                """);

        Optional<List<RankedProduct>> found = cache.get(KEY, Set.of(101L, 102L), 10);

        assertThat(found).isEmpty();
        verify(redisTemplate).delete(KEY);
    }

    @Test
    void getFailsOpenWhenRedisIsUnavailable() {
        when(valueOperations.get(KEY)).thenThrow(new RedisConnectionFailureException("down"));

        Optional<List<RankedProduct>> found = cache.get(KEY, Set.of(101L), 10);

        assertThat(found).isEmpty();
    }

    @Test
    void putStoresValidatedRankingWithConfiguredTtl() {
        List<RankedProduct> ranked = List.of(
                new RankedProduct(101L, 1, new BigDecimal("0.8600"))
        );

        cache.put(KEY, ranked, Set.of(101L), 10);

        ArgumentCaptor<String> payload = ArgumentCaptor.forClass(String.class);
        verify(valueOperations).set(eq(KEY), payload.capture(), eq(Duration.ofMinutes(30)));
        assertThat(payload.getValue()).contains("\"formatVersion\":1");
        assertThat(payload.getValue()).contains("\"productId\":101");
    }

    @Test
    void putSkipsEmptyRanking() {
        cache.put(KEY, List.of(), Set.of(101L), 10);

        verify(valueOperations, never()).set(eq(KEY), anyString(), eq(Duration.ofMinutes(30)));
    }
}
