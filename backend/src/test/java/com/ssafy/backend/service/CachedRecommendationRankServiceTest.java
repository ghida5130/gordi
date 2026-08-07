package com.ssafy.backend.service;

import com.ssafy.backend.config.RecommendationRankCacheProperties;
import com.ssafy.backend.dto.recommendation.RankCandidate;
import com.ssafy.backend.dto.recommendation.RankCondition;
import com.ssafy.backend.dto.recommendation.RankRequest;
import com.ssafy.backend.dto.recommendation.RankedProduct;
import com.ssafy.backend.infra.RecommendationRankCacheKeyFactory;
import com.ssafy.backend.infra.RecommendationRankClient;
import com.ssafy.backend.infra.RedisRecommendationRankCache;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CachedRecommendationRankServiceTest {

    @Mock
    private RedisRecommendationRankCache cache;
    @Mock
    private RecommendationRankClient rankClient;

    @Test
    void cacheHitSkipsRankClient() {
        RecommendationRankCacheProperties properties = properties(true);
        CachedRecommendationRankService service = service(properties);
        List<RankedProduct> cached = List.of(
                new RankedProduct(101L, 1, new BigDecimal("0.8600"))
        );
        when(cache.get(anyString(), anySet(), anyInt())).thenReturn(Optional.of(cached));

        List<RankedProduct> result = service.rank(request());

        assertThat(result).isSameAs(cached);
        verify(rankClient, never()).rank(any());
        verify(cache, never()).put(anyString(), any(), anySet(), anyInt());
    }

    @Test
    void cacheMissCallsRankClientWithCanonicalRequestAndStoresResult() {
        RecommendationRankCacheProperties properties = properties(true);
        CachedRecommendationRankService service = service(properties);
        List<RankedProduct> ranked = List.of(
                new RankedProduct(101L, 1, new BigDecimal("0.8600"))
        );
        when(cache.get(anyString(), anySet(), anyInt())).thenReturn(Optional.empty());
        when(rankClient.rank(any(RankRequest.class))).thenReturn(ranked);

        List<RankedProduct> result = service.rank(request());

        assertThat(result).isSameAs(ranked);
        org.mockito.ArgumentCaptor<RankRequest> requestCaptor =
                org.mockito.ArgumentCaptor.forClass(RankRequest.class);
        verify(rankClient).rank(requestCaptor.capture());
        assertThat(requestCaptor.getValue().condition().moods()).containsExactly("CASUAL", "STREET");
        assertThat(requestCaptor.getValue().condition().tpo()).isEqualTo("여름 데이트");
        verify(cache).put(anyString(), any(), anySet(), anyInt());
    }

    @Test
    void disabledCacheDelegatesOriginalRequestDirectly() {
        RecommendationRankCacheProperties properties = properties(false);
        CachedRecommendationRankService service = service(properties);
        RankRequest request = request();
        List<RankedProduct> ranked = List.of(
                new RankedProduct(101L, 1, new BigDecimal("0.8600"))
        );
        when(rankClient.rank(request)).thenReturn(ranked);

        List<RankedProduct> result = service.rank(request);

        assertThat(result).isSameAs(ranked);
        verify(cache, never()).get(anyString(), anySet(), anyInt());
        verify(cache, never()).put(anyString(), any(), anySet(), anyInt());
    }

    private CachedRecommendationRankService service(RecommendationRankCacheProperties properties) {
        RecommendationRankCacheKeyFactory keyFactory =
                new RecommendationRankCacheKeyFactory(new ObjectMapper(), properties);
        return new CachedRecommendationRankService(properties, keyFactory, cache, rankClient);
    }

    private RecommendationRankCacheProperties properties(boolean enabled) {
        return new RecommendationRankCacheProperties(
                enabled,
                Duration.ofMinutes(30),
                "v1",
                "2.0"
        );
    }

    private RankRequest request() {
        return new RankRequest(
                21L,
                new RankCondition(
                        "MALE",
                        "TOP",
                        "LONG_SLEEVE",
                        30_000,
                        120_000,
                        List.of("STREET", "CASUAL"),
                        "  여름\t데이트  "
                ),
                10,
                List.of(new RankCandidate(
                        101L,
                        "product 101",
                        "GORDI",
                        39_000,
                        "MALE",
                        "TOP",
                        "LONG_SLEEVE",
                        "description"
                ))
        );
    }
}
