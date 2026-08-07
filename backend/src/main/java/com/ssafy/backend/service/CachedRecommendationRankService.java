package com.ssafy.backend.service;

import com.ssafy.backend.config.RecommendationRankCacheProperties;
import com.ssafy.backend.dto.recommendation.RankRequest;
import com.ssafy.backend.dto.recommendation.RankedProduct;
import com.ssafy.backend.infra.RecommendationRankCacheKeyFactory;
import com.ssafy.backend.infra.RecommendationRankClient;
import com.ssafy.backend.infra.RedisRecommendationRankCache;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class CachedRecommendationRankService {

    private final RecommendationRankCacheProperties properties;
    private final RecommendationRankCacheKeyFactory keyFactory;
    private final RedisRecommendationRankCache cache;
    private final RecommendationRankClient rankClient;

    public CachedRecommendationRankService(
            RecommendationRankCacheProperties properties,
            RecommendationRankCacheKeyFactory keyFactory,
            RedisRecommendationRankCache cache,
            RecommendationRankClient rankClient
    ) {
        this.properties = properties;
        this.keyFactory = keyFactory;
        this.cache = cache;
        this.rankClient = rankClient;
    }

    public List<RankedProduct> rank(RankRequest request) {
        if (!properties.isEnabled()) {
            return rankClient.rank(request);
        }

        RecommendationRankCacheKeyFactory.PreparedRankRequest prepared = keyFactory.prepare(request);
        Set<Long> candidateProductIds = prepared.request().candidates().stream()
                .map(candidate -> candidate.productId())
                .collect(Collectors.toUnmodifiableSet());

        return cache.get(prepared.cacheKey(), candidateProductIds, prepared.request().limit())
                .orElseGet(() -> {
                    List<RankedProduct> ranked = rankClient.rank(prepared.request());
                    cache.put(
                            prepared.cacheKey(),
                            ranked,
                            candidateProductIds,
                            prepared.request().limit()
                    );
                    return ranked;
                });
    }
}
