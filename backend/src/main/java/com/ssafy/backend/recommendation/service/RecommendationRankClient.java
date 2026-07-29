package com.ssafy.backend.recommendation.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.recommendation.dto.ai.RankRequest;
import com.ssafy.backend.recommendation.dto.ai.RankResponse;
import com.ssafy.backend.recommendation.dto.ai.RankedProduct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;

// FastAPI 순위 계산 호출 (/internal/v1/recommendations/rank)
@Component
public class RecommendationRankClient {

    private static final Logger log = LoggerFactory.getLogger(RecommendationRankClient.class);
    private static final String RANK_PATH = "/internal/v1/recommendations/rank";
    private static final String INTERNAL_KEY_HEADER = "X-Internal-Api-Key";

    private final RestClient aiRestClient;
    private final String internalApiKey;

    public RecommendationRankClient(
            RestClient aiRestClient,
            @Value("${gordi.ai.internal-api-key:}") String internalApiKey
    ) {
        this.aiRestClient = aiRestClient;
        this.internalApiKey = internalApiKey;
    }

    // 순위 계산 결과를 순위 오름차순으로 반환. 실패는 DEPENDENCY_UNAVAILABLE 로 변환한다.
    public List<RankedProduct> rank(RankRequest request) {
        RankResponse response;
        try {
            response = aiRestClient.post()
                    .uri(RANK_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .headers(headers -> {
                        if (StringUtils.hasText(internalApiKey)) {
                            headers.set(INTERNAL_KEY_HEADER, internalApiKey);
                        }
                    })
                    .body(request)
                    .retrieve()
                    .body(RankResponse.class);
        } catch (RestClientException exception) {
            log.error(
                    "FastAPI rank call failed. recommendationId={}, exceptionType={}",
                    request.recommendationId(),
                    exception.getClass().getName()
            );
            throw new ApiException(ErrorCode.DEPENDENCY_UNAVAILABLE, "추천 순위 계산 서비스를 사용할 수 없습니다.");
        }

        if (response == null || response.ranked() == null) {
            log.error("FastAPI rank response was empty. recommendationId={}", request.recommendationId());
            throw new ApiException(ErrorCode.DEPENDENCY_UNAVAILABLE, "추천 순위 계산 응답이 올바르지 않습니다.");
        }

        return response.ranked().stream()
                .filter(ranked -> ranked.productId() != null && ranked.rank() != null)
                .sorted((left, right) -> Integer.compare(left.rank(), right.rank()))
                .toList();
    }
}
