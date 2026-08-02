package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.config.RecommendationPolicy;
import com.ssafy.backend.config.enums.CategoryCode;
import com.ssafy.backend.config.enums.EmptyReason;
import com.ssafy.backend.config.enums.GenderCode;
import com.ssafy.backend.config.enums.MoodCode;
import com.ssafy.backend.config.enums.RecommendationStatus;
import com.ssafy.backend.domain.Product;
import com.ssafy.backend.domain.Recommendation;
import com.ssafy.backend.domain.RecommendationItem;
import com.ssafy.backend.domain.RecommendationMood;
import com.ssafy.backend.domain.User;
import com.ssafy.backend.dto.recommendation.RankCandidate;
import com.ssafy.backend.dto.recommendation.RankCondition;
import com.ssafy.backend.dto.recommendation.RankRequest;
import com.ssafy.backend.dto.recommendation.RankedProduct;
import com.ssafy.backend.dto.recommendation.RecommendationItemResponse;
import com.ssafy.backend.dto.recommendation.RecommendationOptionsResponse;
import com.ssafy.backend.dto.recommendation.RecommendationRequest;
import com.ssafy.backend.dto.recommendation.RecommendationResponse;
import com.ssafy.backend.dto.recommendation.ReplacedItemResponse;
import com.ssafy.backend.dto.recommendation.ReplacementRequest;
import com.ssafy.backend.dto.recommendation.ReplacementResponse;
import com.ssafy.backend.infra.RecommendationRankClient;
import com.ssafy.backend.repository.ProductRepository;
import com.ssafy.backend.repository.RecommendationItemRepository;
import com.ssafy.backend.repository.RecommendationMoodRepository;
import com.ssafy.backend.repository.RecommendationRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class RecommendationService {

    private static final String CREATE_ENDPOINT = "POST /api/v1/recommendations";
    private static final String REPLACE_ENDPOINT = "POST /api/v1/recommendations/{id}/replacements";

    private final RecommendationRepository recommendationRepository;
    private final RecommendationItemRepository recommendationItemRepository;
    private final RecommendationMoodRepository recommendationMoodRepository;
    private final ProductRepository productRepository;
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final RecommendationRankClient rankClient;
    private final IdempotencyService idempotencyService;
    private final RecommendationPolicy policy;

    public RecommendationService(
            RecommendationRepository recommendationRepository,
            RecommendationItemRepository recommendationItemRepository,
            RecommendationMoodRepository recommendationMoodRepository,
            ProductRepository productRepository,
            RoomRepository roomRepository,
            UserRepository userRepository,
            RecommendationRankClient rankClient,
            IdempotencyService idempotencyService,
            RecommendationPolicy policy
    ) {
        this.recommendationRepository = recommendationRepository;
        this.recommendationItemRepository = recommendationItemRepository;
        this.recommendationMoodRepository = recommendationMoodRepository;
        this.productRepository = productRepository;
        this.roomRepository = roomRepository;
        this.userRepository = userRepository;
        this.rankClient = rankClient;
        this.idempotencyService = idempotencyService;
        this.policy = policy;
    }

    // ---------- 추천 옵션 조회 ----------

    // 프론트엔드가 하드코딩하지 않도록 옵션·추천 개수·스키마 버전을 함께 내려준다.
    public RecommendationOptionsResponse readOptions() {
        return RecommendationOptionsResponse.from(policy);
    }

    // ---------- 추천 스냅샷 생성 ----------

    @Transactional
    public RecommendationResponse createSnapshot(RecommendationRequest request, String idempotencyKey) {
        User user = currentUser();
        String gender = resolveGender(user);

        CategoryCode category = resolveCategory(request.category());
        String subcategory = resolveSubcategory(category, request.subcategory());
        List<String> moods = resolveMoods(request.moods());
        validateBudget(request.budgetMin(), request.budgetMax());

        String requestHash = idempotencyService.hashRequest(
                gender,
                category.name(),
                subcategory,
                request.budgetMin(),
                request.budgetMax(),
                String.join(",", moods)
        );
        Optional<RecommendationResponse> replay = idempotencyService.findReplay(
                user.getId(),
                idempotencyKey,
                CREATE_ENDPOINT,
                requestHash,
                RecommendationResponse.class
        );
        if (replay.isPresent()) {
            return replay.get();
        }

        Recommendation recommendation = recommendationRepository.save(Recommendation.builder()
                .user(user)
                .gender(gender)
                .category(category.name())
                .subcategory(subcategory)
                .budgetMin(request.budgetMin())
                .budgetMax(request.budgetMax())
                .status(RecommendationStatus.READY.name())
                .version(1L)
                .build());
        saveMoods(recommendation, moods);

        List<Product> candidates = productRepository.findMatching(
                category.name(),
                subcategory,
                gender,
                request.budgetMin(),
                request.budgetMax(),
                PageRequest.of(0, policy.getCandidatePoolSize())
        );

        List<RecommendationItemResponse> items;
        if (candidates.isEmpty()) {
            markEmpty(
                    recommendation,
                    category.name(),
                    subcategory,
                    gender,
                    resolveEmptyReason(category.name(), subcategory, gender)
            );
            items = List.of();
        } else {
            List<RankedProduct> ranked = rankClient.rank(new RankRequest(
                    recommendation.getId(),
                    new RankCondition(
                            gender,
                            category.name(),
                            subcategory,
                            request.budgetMin(),
                            request.budgetMax(),
                            moods
                    ),
                    policy.getResultCount(),
                    candidates.stream().map(RankCandidate::from).toList()
            ));

            items = persistRankedItems(recommendation, 1L, ranked, candidates);
            if (items.isEmpty()) {
                markEmpty(
                        recommendation,
                        category.name(),
                        subcategory,
                        gender,
                        EmptyReason.NO_CANDIDATE_LEFT
                );
            }
        }

        RecommendationResponse response = RecommendationResponse.of(recommendation, moods, items);
        idempotencyService.remember(
                user.getId(),
                idempotencyKey,
                CREATE_ENDPOINT,
                requestHash,
                recommendation.getId(),
                recommendation.getVersion(),
                response
        );

        return response;
    }

    // ---------- 추천 결과 조회 ----------

    @Transactional(readOnly = true)
    public RecommendationResponse readSnapshot(Long recommendationId) {
        User user = currentUser();
        Recommendation recommendation = findRecommendation(recommendationId);

        if (!hasReadAccess(recommendation, user)) {
            throw new ApiException(ErrorCode.FORBIDDEN, Map.of("recommendationId", recommendationId));
        }

        return toResponse(recommendation);
    }

    // ---------- 선택 상품 재추천 ----------

    @Transactional
    public ReplacementResponse replaceItems(
            Long recommendationId,
            ReplacementRequest request,
            String idempotencyKey
    ) {
        User user = currentUser();
        Recommendation recommendation = findRecommendation(recommendationId);

        // 교체는 추천을 만든 본인만 가능
        if (!isOwner(recommendation, user)) {
            throw new ApiException(ErrorCode.FORBIDDEN, Map.of("recommendationId", recommendationId));
        }

        List<Long> requestedProductIds = request.productIds().stream().distinct().toList();
        String requestHash = idempotencyService.hashRequest(
                recommendationId,
                request.baseVersion(),
                requestedProductIds.stream().sorted().map(String::valueOf).collect(Collectors.joining(","))
        );
        Optional<ReplacementResponse> replay = idempotencyService.findReplay(
                user.getId(),
                idempotencyKey,
                REPLACE_ENDPOINT,
                requestHash,
                ReplacementResponse.class
        );
        if (replay.isPresent()) {
            return replay.get();
        }

        if (!recommendation.getVersion().equals(request.baseVersion())) {
            throw new ApiException(ErrorCode.VERSION_CONFLICT, Map.of(
                    "baseVersion", request.baseVersion(),
                    "currentVersion", recommendation.getVersion()
            ));
        }

        List<RecommendationItem> currentItems = recommendationItemRepository.findVersionItems(
                recommendationId,
                request.baseVersion()
        );
        if (currentItems.isEmpty()) {
            throw new ApiException(ErrorCode.CONFLICT, "교체할 추천 결과가 없습니다.", Map.of(
                    "recommendationId", recommendationId,
                    "version", request.baseVersion()
            ));
        }

        Map<Long, RecommendationItem> currentByProductId = currentItems.stream()
                .collect(Collectors.toMap(
                        item -> item.getProduct().getId(),
                        Function.identity(),
                        (left, right) -> left,
                        LinkedHashMap::new
                ));

        List<Long> unknownProductIds = requestedProductIds.stream()
                .filter(productId -> !currentByProductId.containsKey(productId))
                .toList();
        if (!unknownProductIds.isEmpty()) {
            throw new ApiException(
                    ErrorCode.BAD_REQUEST,
                    "현재 버전에 포함되지 않은 상품은 교체할 수 없습니다.",
                    Map.of("productIds", unknownProductIds)
            );
        }

        // 과거에 노출된 모든 상품을 제외하고 순위를 다시 계산
        Set<Long> exposedProductIds = new LinkedHashSet<>(
                recommendationItemRepository.findAllExposedProductIds(recommendationId)
        );
        List<Product> candidates = productRepository.findMatchingExcluding(
                recommendation.getCategory(),
                recommendation.getSubcategory(),
                recommendation.getGender(),
                recommendation.getBudgetMin(),
                recommendation.getBudgetMax(),
                exposedProductIds,
                PageRequest.of(0, policy.getCandidatePoolSize())
        );

        List<ScoredProduct> replacements = candidates.isEmpty()
                ? List.of()
                : pickReplacements(recommendation, candidates, requestedProductIds.size());

        ReplacementResponse response = replacements.isEmpty()
                ? unchangedReplacement(recommendation, currentItems, requestedProductIds)
                : applyReplacements(recommendation, currentItems, requestedProductIds, replacements);

        idempotencyService.remember(
                user.getId(),
                idempotencyKey,
                REPLACE_ENDPOINT,
                requestHash,
                recommendationId,
                response.version(),
                response
        );

        return response;
    }

    // ---------- 내부 구현 ----------

    // 교체 후보가 없으면 새 버전을 만들지 않고 현재 버전을 그대로 반환한다.
    private ReplacementResponse unchangedReplacement(
            Recommendation recommendation,
            List<RecommendationItem> currentItems,
            List<Long> requestedProductIds
    ) {
        return new ReplacementResponse(
                recommendation.getId(),
                recommendation.getStatus(),
                recommendation.getVersion(),
                currentItems.stream().map(RecommendationItemResponse::from).toList(),
                List.of(),
                requestedProductIds
        );
    }

    private ReplacementResponse applyReplacements(
            Recommendation recommendation,
            List<RecommendationItem> currentItems,
            List<Long> requestedProductIds,
            List<ScoredProduct> replacements
    ) {
        long nextVersion = recommendation.getVersion() + 1;

        // 교체 대상은 기존 순위 오름차순으로 처리
        List<Long> targets = currentItems.stream()
                .map(item -> item.getProduct().getId())
                .filter(requestedProductIds::contains)
                .toList();

        Map<Long, ScoredProduct> assigned = new LinkedHashMap<>();
        List<Long> unreplacedProductIds = new ArrayList<>();
        int cursor = 0;
        for (Long target : targets) {
            if (cursor < replacements.size()) {
                assigned.put(target, replacements.get(cursor++));
            } else {
                unreplacedProductIds.add(target);
            }
        }

        List<RecommendationItem> nextItems = new ArrayList<>();
        List<ReplacedItemResponse> replaced = new ArrayList<>();
        for (RecommendationItem item : currentItems) {
            Long oldProductId = item.getProduct().getId();
            ScoredProduct replacement = assigned.get(oldProductId);

            if (replacement == null) {
                nextItems.add(RecommendationItem.builder()
                        .recommendation(recommendation)
                        .product(item.getProduct())
                        .recommendationVersion(nextVersion)
                        .rank(item.getRank())
                        .score(item.getScore())
                        .build());
                continue;
            }

            // 교체된 자리는 새 상품의 점수로 갱신하고 순위는 유지
            nextItems.add(RecommendationItem.builder()
                    .recommendation(recommendation)
                    .product(replacement.product())
                    .recommendationVersion(nextVersion)
                    .rank(item.getRank())
                    .score(replacement.score())
                    .build());
            replaced.add(new ReplacedItemResponse(oldProductId, replacement.product().getId(), item.getRank()));
        }

        recommendationItemRepository.saveAll(nextItems);
        recommendation.setVersion(nextVersion);
        recommendationRepository.save(recommendation);

        return new ReplacementResponse(
                recommendation.getId(),
                recommendation.getStatus(),
                nextVersion,
                nextItems.stream().map(RecommendationItemResponse::from).toList(),
                replaced,
                unreplacedProductIds
        );
    }

    // 교체 후보 중 상위 limit 개를 FastAPI 순위대로 선택
    private List<ScoredProduct> pickReplacements(
            Recommendation recommendation,
            List<Product> candidates,
            int limit
    ) {
        List<String> moods = readMoodCodes(recommendation.getId());
        List<RankedProduct> ranked = rankClient.rank(new RankRequest(
                recommendation.getId(),
                new RankCondition(
                        recommendation.getGender(),
                        recommendation.getCategory(),
                        recommendation.getSubcategory(),
                        recommendation.getBudgetMin(),
                        recommendation.getBudgetMax(),
                        moods
                ),
                limit,
                candidates.stream().map(RankCandidate::from).toList()
        ));

        Map<Long, Product> candidateById = candidates.stream()
                .collect(Collectors.toMap(Product::getId, Function.identity(), (left, right) -> left));

        return ranked.stream()
                .map(rankedProduct -> {
                    Product product = candidateById.get(rankedProduct.productId());
                    return product == null ? null : new ScoredProduct(product, rankedProduct.score());
                })
                .filter(scored -> scored != null)
                .limit(limit)
                .toList();
    }

    // FastAPI 점수를 상품과 함께 들고 다니기 위한 내부 조합
    private record ScoredProduct(Product product, java.math.BigDecimal score) {
    }

    // FastAPI 순위를 그대로 추천 결과로 저장
    private List<RecommendationItemResponse> persistRankedItems(
            Recommendation recommendation,
            long version,
            List<RankedProduct> ranked,
            List<Product> candidates
    ) {
        Map<Long, Product> candidateById = candidates.stream()
                .collect(Collectors.toMap(Product::getId, Function.identity(), (left, right) -> left));

        List<RecommendationItem> items = new ArrayList<>();
        int rank = 1;
        for (RankedProduct rankedProduct : ranked) {
            Product product = candidateById.get(rankedProduct.productId());
            if (product == null) {
                continue;
            }
            items.add(RecommendationItem.builder()
                    .recommendation(recommendation)
                    .product(product)
                    .recommendationVersion(version)
                    .rank(rank++)
                    .score(rankedProduct.score())
                    .build());
        }

        recommendationItemRepository.saveAll(items);
        return items.stream().map(RecommendationItemResponse::from).toList();
    }

    private void saveMoods(Recommendation recommendation, List<String> moods) {
        List<RecommendationMood> saved = new ArrayList<>();
        int position = 1;
        for (String mood : moods) {
            saved.add(RecommendationMood.builder()
                    .recommendation(recommendation)
                    .moodCode(mood)
                    .position(position++)
                    .build());
        }
        recommendationMoodRepository.saveAll(saved);
    }

    // 빈 결과는 오류가 아니라 EMPTY 상태로 저장하고, 예산은 자동 확대하지 않고 제안만 한다.
    private void markEmpty(
            Recommendation recommendation,
            String category,
            String subcategory,
            String gender,
            EmptyReason emptyReason
    ) {
        recommendation.setStatus(RecommendationStatus.EMPTY.name());
        recommendation.setEmptyReason(emptyReason.name());

        if (emptyReason == EmptyReason.NO_PRODUCT_IN_BUDGET) {
            recommendation.setSuggestedBudgetMin(productRepository.findMinPrice(category, subcategory, gender));
            recommendation.setSuggestedBudgetMax(productRepository.findMaxPrice(category, subcategory, gender));
        }

        recommendationRepository.save(recommendation);
    }

    private EmptyReason resolveEmptyReason(String category, String subcategory, String gender) {
        Integer minPrice = productRepository.findMinPrice(category, subcategory, gender);
        return minPrice == null ? EmptyReason.NO_PRODUCT_IN_CATEGORY : EmptyReason.NO_PRODUCT_IN_BUDGET;
    }

    private RecommendationResponse toResponse(Recommendation recommendation) {
        List<RecommendationItemResponse> items = recommendationItemRepository
                .findVersionItems(recommendation.getId(), recommendation.getVersion())
                .stream()
                .map(RecommendationItemResponse::from)
                .toList();

        return RecommendationResponse.of(recommendation, readMoodCodes(recommendation.getId()), items);
    }

    private List<String> readMoodCodes(Long recommendationId) {
        return recommendationMoodRepository.findByRecommendationIdOrderByPositionAsc(recommendationId)
                .stream()
                .map(RecommendationMood::getMoodCode)
                .toList();
    }

    private Recommendation findRecommendation(Long recommendationId) {
        return recommendationRepository.findById(recommendationId)
                .orElseThrow(() -> new ApiException(
                        ErrorCode.RESOURCE_NOT_FOUND,
                        "추천을 찾을 수 없습니다.",
                        Map.of("recommendationId", recommendationId)
                ));
    }

    // 본인이 만든 추천 또는 참여 권한이 있는 방에서 참조 중인 추천만 조회 가능
    private boolean hasReadAccess(Recommendation recommendation, User user) {
        return isOwner(recommendation, user)
                || roomRepository.existsByRecommendationIdAndHostUserId(recommendation.getId(), user.getId());
    }

    private boolean isOwner(Recommendation recommendation, User user) {
        return recommendation.getUser().getId().equals(user.getId());
    }

    private CategoryCode resolveCategory(String category) {
        return CategoryCode.find(category)
                .orElseThrow(() -> new ApiException(
                        ErrorCode.BAD_REQUEST,
                        "지원하지 않는 카테고리입니다.",
                        Map.of("category", String.valueOf(category))
                ));
    }

    private String resolveSubcategory(CategoryCode category, String subcategory) {
        if (!StringUtils.hasText(subcategory)) {
            return null;
        }
        if (!category.supports(subcategory)) {
            throw new ApiException(
                    ErrorCode.BAD_REQUEST,
                    "카테고리에 속하지 않는 세부 분류입니다.",
                    Map.of("category", category.getCode(), "subcategory", subcategory)
            );
        }
        return subcategory;
    }

    // 선택 순서는 유지하고 중복만 제거
    private List<String> resolveMoods(List<String> moods) {
        Set<String> resolved = new LinkedHashSet<>();
        for (String mood : moods) {
            MoodCode moodCode = MoodCode.find(mood)
                    .orElseThrow(() -> new ApiException(
                            ErrorCode.BAD_REQUEST,
                            "지원하지 않는 무드입니다.",
                            Map.of("mood", String.valueOf(mood))
                    ));
            resolved.add(moodCode.getCode());
        }
        return List.copyOf(resolved);
    }

    private void validateBudget(Integer budgetMin, Integer budgetMax) {
        if (budgetMin > budgetMax) {
            throw new ApiException(ErrorCode.INVALID_BUDGET_RANGE, Map.of(
                    "budgetMin", budgetMin,
                    "budgetMax", budgetMax
            ));
        }
        if (!policy.isBudgetWithinPolicy(budgetMin, budgetMax)) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "예산이 허용 범위를 벗어났습니다.", Map.of(
                    "minAllowed", policy.getBudgetMinAllowed(),
                    "maxAllowed", policy.getBudgetMaxAllowed()
            ));
        }
    }

    private String resolveGender(User user) {
        if (user.getAvatar() == null || !StringUtils.hasText(user.getAvatar().getGender())) {
            throw new ApiException(
                    ErrorCode.BAD_REQUEST,
                    "추천 전에 아바타를 선택해야 합니다."
            );
        }

        GenderCode gender = GenderCode.find(user.getAvatar().getGender())
                .filter(code -> code != GenderCode.UNISEX)
                .orElseThrow(() -> new ApiException(
                        ErrorCode.BAD_REQUEST,
                        "아바타 성별이 올바르지 않습니다.",
                        Map.of("gender", user.getAvatar().getGender())
                ));
        return gender.name();
    }

    private User currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !StringUtils.hasText(authentication.getName())) {
            throw new ApiException(ErrorCode.UNAUTHORIZED);
        }

        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
    }
}
