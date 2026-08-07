package com.ssafy.backend.infra;

import com.ssafy.backend.config.RecommendationRankCacheProperties;
import com.ssafy.backend.dto.recommendation.RankCandidate;
import com.ssafy.backend.dto.recommendation.RankCondition;
import com.ssafy.backend.dto.recommendation.RankRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RecommendationRankCacheKeyFactoryTest {

    private RecommendationRankCacheKeyFactory keyFactory;

    @BeforeEach
    void setUp() {
        RecommendationRankCacheProperties properties = new RecommendationRankCacheProperties(
                true,
                Duration.ofMinutes(30),
                "v1",
                "2.0"
        );
        keyFactory = new RecommendationRankCacheKeyFactory(new ObjectMapper(), properties);
    }

    @Test
    void equivalentMoodOrderTpoWhitespaceAndCandidateOrderProduceSameKey() {
        RankRequest first = request(
                21L,
                30_000,
                120_000,
                List.of("STREET", "CASUAL"),
                "  여름\t 데이트  ",
                List.of(candidate(102L, 89_000, "second"), candidate(101L, 39_000, "first"))
        );
        RankRequest second = request(
                99L,
                30_000,
                120_000,
                List.of("CASUAL", "STREET", "CASUAL"),
                "여름 데이트",
                List.of(candidate(101L, 39_000, "first"), candidate(102L, 89_000, "second"))
        );

        RecommendationRankCacheKeyFactory.PreparedRankRequest preparedFirst = keyFactory.prepare(first);
        RecommendationRankCacheKeyFactory.PreparedRankRequest preparedSecond = keyFactory.prepare(second);

        assertThat(preparedFirst.cacheKey()).isEqualTo(preparedSecond.cacheKey());
        assertThat(preparedFirst.request().recommendationId()).isEqualTo(21L);
        assertThat(preparedSecond.request().recommendationId()).isEqualTo(99L);
        assertThat(preparedFirst.request().condition().moods()).containsExactly("CASUAL", "STREET");
        assertThat(preparedFirst.request().condition().tpo()).isEqualTo("여름 데이트");
        assertThat(preparedFirst.request().candidates())
                .extracting(RankCandidate::productId)
                .containsExactly(101L, 102L);
    }

    @Test
    void tpoInnerWhitespaceDifferenceProducesSameKeyButKeepsRequestTpo() {
        RankRequest spaced = request(
                21L,
                30_000,
                120_000,
                List.of("CASUAL"),
                "생일 파티",
                List.of(candidate(101L, 39_000, "first"))
        );
        RankRequest compact = request(
                21L,
                30_000,
                120_000,
                List.of("CASUAL"),
                "생일파티",
                List.of(candidate(101L, 39_000, "first"))
        );

        RecommendationRankCacheKeyFactory.PreparedRankRequest preparedSpaced = keyFactory.prepare(spaced);
        RecommendationRankCacheKeyFactory.PreparedRankRequest preparedCompact = keyFactory.prepare(compact);

        assertThat(preparedSpaced.cacheKey()).isEqualTo(preparedCompact.cacheKey());
        assertThat(preparedSpaced.request().condition().tpo()).isEqualTo("생일 파티");
        assertThat(preparedCompact.request().condition().tpo()).isEqualTo("생일파티");
    }

    @Test
    void exactBudgetChangeProducesDifferentKey() {
        RankRequest first = request(
                21L,
                30_000,
                120_000,
                List.of("CASUAL"),
                "",
                List.of(candidate(101L, 39_000, "first"))
        );
        RankRequest second = request(
                21L,
                31_000,
                120_000,
                List.of("CASUAL"),
                "",
                List.of(candidate(101L, 39_000, "first"))
        );

        assertThat(keyFactory.prepare(first).cacheKey())
                .isNotEqualTo(keyFactory.prepare(second).cacheKey());
    }

    @Test
    void mutableCandidateFieldChangeProducesDifferentKey() {
        RankRequest first = request(
                21L,
                30_000,
                120_000,
                List.of("CASUAL"),
                "",
                List.of(candidate(101L, 39_000, "original description"))
        );
        RankRequest second = request(
                21L,
                30_000,
                120_000,
                List.of("CASUAL"),
                "",
                List.of(candidate(101L, 39_000, "updated description"))
        );

        assertThat(keyFactory.prepare(first).cacheKey())
                .isNotEqualTo(keyFactory.prepare(second).cacheKey());
    }

    private RankRequest request(
            Long recommendationId,
            int budgetMin,
            int budgetMax,
            List<String> moods,
            String tpo,
            List<RankCandidate> candidates
    ) {
        return new RankRequest(
                recommendationId,
                new RankCondition(
                        "MALE",
                        "TOP",
                        "LONG_SLEEVE",
                        budgetMin,
                        budgetMax,
                        moods,
                        tpo
                ),
                10,
                candidates
        );
    }

    private RankCandidate candidate(Long productId, int price, String description) {
        return new RankCandidate(
                productId,
                "product " + productId,
                "GORDI",
                price,
                "MALE",
                "TOP",
                "LONG_SLEEVE",
                description
        );
    }
}
