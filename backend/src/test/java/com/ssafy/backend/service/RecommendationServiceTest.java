package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.config.RecommendationPolicy;
import com.ssafy.backend.config.enums.EmptyReason;
import com.ssafy.backend.domain.Avatar;
import com.ssafy.backend.domain.Product;
import com.ssafy.backend.domain.Recommendation;
import com.ssafy.backend.domain.RecommendationItem;
import com.ssafy.backend.domain.RecommendationMood;
import com.ssafy.backend.domain.User;
import com.ssafy.backend.dto.recommendation.RankRequest;
import com.ssafy.backend.dto.recommendation.RankedProduct;
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
import com.ssafy.backend.util.ImageUrlResolver;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Pageable;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RecommendationServiceTest {

    private static final String EMAIL = "gordi@example.com";

    @Mock
    private RecommendationRepository recommendationRepository;
    @Mock
    private RecommendationItemRepository recommendationItemRepository;
    @Mock
    private RecommendationMoodRepository recommendationMoodRepository;
    @Mock
    private ProductRepository productRepository;
    @Mock
    private RoomRepository roomRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private RecommendationRankClient rankClient;
    @Mock
    private IdempotencyService idempotencyService;

    private RecommendationPolicy policy;
    private RecommendationService recommendationService;
    private User owner;

    @BeforeEach
    void setUp() {
        policy = new RecommendationPolicy(0, 5_000_000, "KRW", 10_000, 12, 200, "2.0");
        recommendationService = new RecommendationService(
                recommendationRepository,
                recommendationItemRepository,
                recommendationMoodRepository,
                productRepository,
                roomRepository,
                userRepository,
                rankClient,
                idempotencyService,
                policy,
                new ImageUrlResolver("")
        );

        owner = user(1L);

        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(owner));
        when(recommendationRepository.save(any(Recommendation.class))).thenAnswer(invocation -> {
            Recommendation saved = invocation.getArgument(0);
            if (saved.getId() == null) {
                saved.setId(21L);
            }
            return saved;
        });
        when(recommendationItemRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(recommendationMoodRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

        authenticateAs(EMAIL);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    // ---------- 추천 스냅샷 생성 ----------

    @Test
    void createSnapshotStoresFastApiRankingOrder() {
        Product first = product(101L, 39_000);
        Product second = product(102L, 89_000);
        when(productRepository.findMatching(
                eq("TOP"), eq("LONG_SLEEVE"), eq("MALE"), eq(30_000), eq(120_000), any(Pageable.class)))
                .thenReturn(List.of(first, second));
        when(rankClient.rank(any(RankRequest.class))).thenReturn(List.of(
                new RankedProduct(102L, 1, new BigDecimal("0.8600")),
                new RankedProduct(101L, 2, new BigDecimal("0.7100"))
        ));

        RecommendationResponse response = recommendationService.createSnapshot(request(), "key-1");

        assertThat(response.recommendationId()).isEqualTo(21L);
        assertThat(response.status()).isEqualTo("READY");
        assertThat(response.version()).isEqualTo(1L);
        assertThat(response.emptyReason()).isNull();
        assertThat(response.suggestedBudget()).isNull();
        assertThat(response.items())
                .extracting("productId", "rank")
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(102L, 1),
                        org.assertj.core.groups.Tuple.tuple(101L, 2)
                );
        assertThat(response.condition().category()).isEqualTo("TOP");
        assertThat(response.condition().subcategory()).isEqualTo("LONG_SLEEVE");
        assertThat(response.condition().gender()).isEqualTo("MALE");
        assertThat(response.condition().moods()).containsExactly("MINIMAL", "CASUAL");
    }

    @Test
    void createSnapshotPassesPolicyResultCountToFastApi() {
        when(productRepository.findMatching(any(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(List.of(product(101L, 39_000)));
        when(rankClient.rank(any(RankRequest.class)))
                .thenReturn(List.of(new RankedProduct(101L, 1, new BigDecimal("0.5000"))));

        recommendationService.createSnapshot(request(), null);

        ArgumentCaptor<RankRequest> captor = ArgumentCaptor.forClass(RankRequest.class);
        verify(rankClient).rank(captor.capture());
        assertThat(captor.getValue().limit()).isEqualTo(12);
        assertThat(captor.getValue().candidates()).hasSize(1);
        assertThat(captor.getValue().condition().gender()).isEqualTo("MALE");
        assertThat(captor.getValue().candidates().getFirst().gender()).isEqualTo("MALE");
        assertThat(captor.getValue().condition().moods()).containsExactly("MINIMAL", "CASUAL");
    }

    // 빈 결과는 오류가 아니라 status=EMPTY 로 반환하며 예산을 자동 확대하지 않는다
    @Test
    void createSnapshotReturnsEmptyStatusWhenNoProductFitsBudget() {
        when(productRepository.findMatching(any(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(List.of());
        when(productRepository.findMinPrice("TOP", "LONG_SLEEVE", "MALE")).thenReturn(150_000);
        when(productRepository.findMaxPrice("TOP", "LONG_SLEEVE", "MALE")).thenReturn(400_000);

        RecommendationResponse response = recommendationService.createSnapshot(request(), null);

        assertThat(response.status()).isEqualTo("EMPTY");
        assertThat(response.emptyReason()).isEqualTo(EmptyReason.NO_PRODUCT_IN_BUDGET.name());
        assertThat(response.items()).isEmpty();
        // 예산은 그대로 유지하고 제안만 내려준다
        assertThat(response.condition().budgetMin()).isEqualTo(30_000);
        assertThat(response.condition().budgetMax()).isEqualTo(120_000);
        assertThat(response.suggestedBudget().budgetMin()).isEqualTo(150_000);
        assertThat(response.suggestedBudget().budgetMax()).isEqualTo(400_000);
        verify(rankClient, never()).rank(any());
    }

    @Test
    void createSnapshotMarksCategoryWithoutProductsSeparately() {
        when(productRepository.findMatching(any(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(List.of());
        when(productRepository.findMinPrice("TOP", "LONG_SLEEVE", "MALE")).thenReturn(null);

        RecommendationResponse response = recommendationService.createSnapshot(request(), null);

        assertThat(response.status()).isEqualTo("EMPTY");
        assertThat(response.emptyReason()).isEqualTo(EmptyReason.NO_PRODUCT_IN_CATEGORY.name());
        assertThat(response.suggestedBudget()).isNull();
    }

    @Test
    void createSnapshotRejectsInvertedBudgetRange() {
        RecommendationRequest inverted =
                new RecommendationRequest("TOP", "LONG_SLEEVE", 120_000, 30_000, List.of("MINIMAL"));

        assertThatThrownBy(() -> recommendationService.createSnapshot(inverted, null))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_BUDGET_RANGE);
    }

    @Test
    void createSnapshotRejectsBudgetOutsidePolicy() {
        RecommendationRequest tooExpensive =
                new RecommendationRequest("TOP", "LONG_SLEEVE", 0, 9_000_000, List.of("MINIMAL"));

        assertThatThrownBy(() -> recommendationService.createSnapshot(tooExpensive, null))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.BAD_REQUEST);
    }

    @Test
    void createSnapshotRejectsUnknownCategoryAndMood() {
        RecommendationRequest unknownCategory =
                new RecommendationRequest("HAT", null, 10_000, 20_000, List.of("MINIMAL"));
        RecommendationRequest unknownMood =
                new RecommendationRequest("TOP", null, 10_000, 20_000, List.of("FANCY"));

        assertThatThrownBy(() -> recommendationService.createSnapshot(unknownCategory, null))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> recommendationService.createSnapshot(unknownMood, null))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void createSnapshotRejectsSubcategoryOutsideCategory() {
        RecommendationRequest mismatched =
                new RecommendationRequest("TOP", "SLACKS", 10_000, 20_000, List.of("MINIMAL"));

        assertThatThrownBy(() -> recommendationService.createSnapshot(mismatched, null))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.BAD_REQUEST);
    }

    @Test
    void createSnapshotRequiresSelectedAvatar() {
        owner.setAvatar(null);

        assertThatThrownBy(() -> recommendationService.createSnapshot(request(), null))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.BAD_REQUEST);
    }

    @Test
    void createSnapshotReplaysStoredResponseForSameIdempotencyKey() {
        RecommendationResponse stored = new RecommendationResponse(
                21L, "READY", 1L, null, List.of(), null, null, null
        );
        when(idempotencyService.findReplay(anyLong(), anyString(), anyString(), any(), eq(RecommendationResponse.class)))
                .thenReturn(Optional.of(stored));

        RecommendationResponse response = recommendationService.createSnapshot(request(), "key-1");

        assertThat(response).isSameAs(stored);
        verify(recommendationRepository, never()).save(any());
        verify(rankClient, never()).rank(any());
    }

    // ---------- 추천 결과 조회 ----------

    @Test
    void readSnapshotReturnsOwnRecommendation() {
        Recommendation recommendation = recommendation(21L, owner, 1L);
        when(recommendationRepository.findById(21L)).thenReturn(Optional.of(recommendation));
        when(recommendationMoodRepository.findByRecommendationIdOrderByPositionAsc(21L))
                .thenReturn(List.of(mood(recommendation, "MINIMAL", 1)));
        when(recommendationItemRepository.findVersionItems(21L, 1L))
                .thenReturn(List.of(item(recommendation, product(101L, 39_000), 1L, 1)));

        RecommendationResponse response = recommendationService.readSnapshot(21L);

        assertThat(response.recommendationId()).isEqualTo(21L);
        assertThat(response.items()).hasSize(1);
        assertThat(response.condition().moods()).containsExactly("MINIMAL");
    }

    @Test
    void readSnapshotAllowsRoomHostOfReferencingRoom() {
        Recommendation recommendation = recommendation(21L, user(2L), 1L);
        when(recommendationRepository.findById(21L)).thenReturn(Optional.of(recommendation));
        when(roomRepository.existsByRecommendationIdAndHostUserId(21L, 1L)).thenReturn(true);

        RecommendationResponse response = recommendationService.readSnapshot(21L);

        assertThat(response.recommendationId()).isEqualTo(21L);
    }

    @Test
    void readSnapshotForbidsUnrelatedUser() {
        when(recommendationRepository.findById(21L)).thenReturn(Optional.of(recommendation(21L, user(2L), 1L)));
        when(roomRepository.existsByRecommendationIdAndHostUserId(21L, 1L)).thenReturn(false);

        assertThatThrownBy(() -> recommendationService.readSnapshot(21L))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    void readSnapshotReportsMissingRecommendation() {
        when(recommendationRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> recommendationService.readSnapshot(99L))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);
    }

    // ---------- 선택 상품 재추천 ----------

    @Test
    void replaceItemsExcludesEveryPreviouslyExposedProduct() {
        Recommendation recommendation = recommendation(21L, owner, 1L);
        Product kept = product(105L, 70_000);
        when(recommendationRepository.findById(21L)).thenReturn(Optional.of(recommendation));
        when(recommendationItemRepository.findVersionItems(21L, 1L)).thenReturn(List.of(
                item(recommendation, product(101L, 39_000), 1L, 1),
                item(recommendation, kept, 1L, 2)
        ));
        when(recommendationItemRepository.findAllExposedProductIds(21L))
                .thenReturn(List.of(101L, 105L, 110L));
        when(productRepository.findMatchingExcluding(
                any(), any(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(List.of(product(121L, 61_000)));
        when(rankClient.rank(any(RankRequest.class)))
                .thenReturn(List.of(new RankedProduct(121L, 1, new BigDecimal("0.9100"))));

        ReplacementResponse response = recommendationService.replaceItems(
                21L,
                new ReplacementRequest(1L, List.of(101L)),
                "key-2"
        );

        ArgumentCaptor<java.util.Collection<Long>> excluded = ArgumentCaptor.captor();
        verify(productRepository).findMatchingExcluding(
                eq("TOP"), eq("LONG_SLEEVE"), eq("MALE"), eq(30_000), eq(120_000),
                excluded.capture(), any(Pageable.class)
        );
        assertThat(excluded.getValue()).containsExactlyInAnyOrder(101L, 105L, 110L);

        assertThat(response.version()).isEqualTo(2L);
        assertThat(response.replaced()).containsExactly(
                new ReplacedItemResponse(101L, 121L, 1)
        );
        assertThat(response.unreplacedProductIds()).isEmpty();
        assertThat(response.items())
                .extracting("productId", "rank")
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(121L, 1),
                        org.assertj.core.groups.Tuple.tuple(105L, 2)
                );
    }

    @Test
    void replaceItemsReportsUnreplacedWhenCandidatesRunOut() {
        Recommendation recommendation = recommendation(21L, owner, 1L);
        when(recommendationRepository.findById(21L)).thenReturn(Optional.of(recommendation));
        when(recommendationItemRepository.findVersionItems(21L, 1L)).thenReturn(List.of(
                item(recommendation, product(101L, 39_000), 1L, 1),
                item(recommendation, product(105L, 70_000), 1L, 2)
        ));
        when(recommendationItemRepository.findAllExposedProductIds(21L)).thenReturn(List.of(101L, 105L));
        when(productRepository.findMatchingExcluding(
                any(), any(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(List.of(product(121L, 61_000)));
        when(rankClient.rank(any(RankRequest.class)))
                .thenReturn(List.of(new RankedProduct(121L, 1, new BigDecimal("0.9100"))));

        ReplacementResponse response = recommendationService.replaceItems(
                21L,
                new ReplacementRequest(1L, List.of(101L, 105L)),
                null
        );

        assertThat(response.replaced()).hasSize(1);
        assertThat(response.unreplacedProductIds()).containsExactly(105L);
    }

    // 교체 후보가 아예 없으면 새 버전을 만들지 않는다
    @Test
    void replaceItemsKeepsVersionWhenNoCandidateRemains() {
        Recommendation recommendation = recommendation(21L, owner, 1L);
        when(recommendationRepository.findById(21L)).thenReturn(Optional.of(recommendation));
        when(recommendationItemRepository.findVersionItems(21L, 1L))
                .thenReturn(List.of(item(recommendation, product(101L, 39_000), 1L, 1)));
        when(recommendationItemRepository.findAllExposedProductIds(21L)).thenReturn(List.of(101L));
        when(productRepository.findMatchingExcluding(
                any(), any(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(List.of());

        ReplacementResponse response = recommendationService.replaceItems(
                21L,
                new ReplacementRequest(1L, List.of(101L)),
                null
        );

        assertThat(response.version()).isEqualTo(1L);
        assertThat(response.replaced()).isEmpty();
        assertThat(response.unreplacedProductIds()).containsExactly(101L);
        verify(rankClient, never()).rank(any());
        verify(recommendationItemRepository, never()).saveAll(any());
    }

    @Test
    void replaceItemsRejectsStaleBaseVersion() {
        Recommendation recommendation = recommendation(21L, owner, 3L);
        when(recommendationRepository.findById(21L)).thenReturn(Optional.of(recommendation));

        assertThatThrownBy(() -> recommendationService.replaceItems(
                21L,
                new ReplacementRequest(1L, List.of(101L)),
                null
        ))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.VERSION_CONFLICT);
    }

    @Test
    void replaceItemsRejectsProductOutsideCurrentVersion() {
        Recommendation recommendation = recommendation(21L, owner, 1L);
        when(recommendationRepository.findById(21L)).thenReturn(Optional.of(recommendation));
        when(recommendationItemRepository.findVersionItems(21L, 1L))
                .thenReturn(List.of(item(recommendation, product(101L, 39_000), 1L, 1)));

        assertThatThrownBy(() -> recommendationService.replaceItems(
                21L,
                new ReplacementRequest(1L, List.of(999L)),
                null
        ))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.BAD_REQUEST);
    }

    @Test
    void replaceItemsForbidsNonOwner() {
        when(recommendationRepository.findById(21L)).thenReturn(Optional.of(recommendation(21L, user(2L), 1L)));

        assertThatThrownBy(() -> recommendationService.replaceItems(
                21L,
                new ReplacementRequest(1L, List.of(101L)),
                null
        ))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    // ---------- 헬퍼 ----------

    private void authenticateAs(String email) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(email, null, List.of())
        );
    }

    private RecommendationRequest request() {
        return new RecommendationRequest("TOP", "LONG_SLEEVE", 30_000, 120_000, List.of("MINIMAL", "CASUAL"));
    }

    private User user(Long id) {
        return User.builder()
                .id(id)
                .email(id == 1L ? EMAIL : "other" + id + "@example.com")
                .password("encoded")
                .nickname("사용자" + id)
                .avatar(Avatar.builder().id(id).gender("MALE").build())
                .build();
    }

    private Recommendation recommendation(Long id, User user, Long version) {
        return Recommendation.builder()
                .id(id)
                .user(user)
                .gender("MALE")
                .category("TOP")
                .subcategory("LONG_SLEEVE")
                .budgetMin(30_000)
                .budgetMax(120_000)
                .status("READY")
                .version(version)
                .build();
    }

    private Product product(Long id, int price) {
        return Product.builder()
                .id(id)
                .name("상품 " + id)
                .brand("GORDI")
                .source("MUSINSA")
                .externalProductId(String.valueOf(id))
                .gender("MALE")
                .price(price)
                .category("TOP")
                .subcategory("LONG_SLEEVE")
                .imageUrl("https://example.com/" + id + ".png")
                .purchaseUrl("https://example.com/buy/" + id)
                .build();
    }

    private RecommendationItem item(Recommendation recommendation, Product product, Long version, int rank) {
        return RecommendationItem.builder()
                .recommendation(recommendation)
                .product(product)
                .recommendationVersion(version)
                .rank(rank)
                .score(new BigDecimal("0.5000"))
                .build();
    }

    private RecommendationMood mood(Recommendation recommendation, String code, int position) {
        return RecommendationMood.builder()
                .recommendation(recommendation)
                .moodCode(code)
                .position(position)
                .build();
    }
}
