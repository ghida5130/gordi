package com.ssafy.backend.infra;

import com.ssafy.backend.config.RecommendationRankCacheProperties;
import com.ssafy.backend.dto.recommendation.RankCandidate;
import com.ssafy.backend.dto.recommendation.RankCondition;
import com.ssafy.backend.dto.recommendation.RankRequest;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;

// gordi:{도메인}:{용도}:{버전}:{식별자}
@Component
public class RecommendationRankCacheKeyFactory {

    private static final String KEY_PREFIX = "gordi:rec:rank";
    private static final int KEY_FORMAT_VERSION = 1;
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private final ObjectMapper objectMapper;
    private final RecommendationRankCacheProperties properties;

    public RecommendationRankCacheKeyFactory(
            ObjectMapper objectMapper,
            RecommendationRankCacheProperties properties
    ) {
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    public PreparedRankRequest prepare(RankRequest request) {
        Objects.requireNonNull(request, "request must not be null");
        Objects.requireNonNull(request.condition(), "rank condition must not be null");
        Objects.requireNonNull(request.candidates(), "rank candidates must not be null");

        RankCondition condition = request.condition();
        List<String> normalizedMoods = condition.moods() == null
                ? List.of()
                : condition.moods().stream()
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();

        RankCondition normalizedCondition = new RankCondition(
                condition.gender(),
                condition.category(),
                condition.subcategory(),
                condition.budgetMin(),
                condition.budgetMax(),
                normalizedMoods,
                normalizeTpo(condition.tpo())
        );
        List<RankCandidate> normalizedCandidates = request.candidates().stream()
                .sorted(Comparator.comparing(RankCandidate::productId))
                .toList();
        RankRequest normalizedRequest = new RankRequest(
                request.recommendationId(),
                normalizedCondition,
                request.limit(),
                normalizedCandidates
        );

        // 캐시 키에서는 TPO의 공백 유무("생일 파티" vs "생일파티")를 같은 조건으로 취급한다.
        // AI로 보내는 요청(normalizedRequest)의 TPO는 입력 원형을 유지한다.
        RankCondition keyCondition = new RankCondition(
                normalizedCondition.gender(),
                normalizedCondition.category(),
                normalizedCondition.subcategory(),
                normalizedCondition.budgetMin(),
                normalizedCondition.budgetMax(),
                normalizedCondition.moods(),
                WHITESPACE.matcher(normalizedCondition.tpo()).replaceAll("")
        );
        CacheKeyInput input = new CacheKeyInput(
                KEY_FORMAT_VERSION,
                properties.getRankerRevision(),
                keyCondition,
                request.limit(),
                normalizedCandidates
        );
        return new PreparedRankRequest(cacheKey(input), normalizedRequest);
    }

    private String normalizeTpo(String tpo) {
        if (tpo == null) {
            return "";
        }
        String normalized = Normalizer.normalize(tpo, Normalizer.Form.NFC).strip();
        return WHITESPACE.matcher(normalized).replaceAll(" ");
    }

    private String cacheKey(CacheKeyInput input) {
        try {
            byte[] serialized = objectMapper.writeValueAsString(input).getBytes(StandardCharsets.UTF_8);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String hash = HexFormat.of().formatHex(digest.digest(serialized));
            return String.join(":", KEY_PREFIX, properties.getKeyVersion(), hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available.", exception);
        } catch (Exception exception) {
            throw new IllegalStateException("Recommendation rank cache key could not be serialized.", exception);
        }
    }

    private record CacheKeyInput(
            int formatVersion,
            String rankerRevision,
            RankCondition condition,
            int limit,
            List<RankCandidate> candidates
    ) {
    }

    public record PreparedRankRequest(String cacheKey, RankRequest request) {
    }
}
