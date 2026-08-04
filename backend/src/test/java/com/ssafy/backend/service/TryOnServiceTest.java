package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.config.TryOnPolicy;
import com.ssafy.backend.config.enums.RoomRole;
import com.ssafy.backend.config.enums.TryOnContextType;
import com.ssafy.backend.config.enums.TryOnJobStatus;
import com.ssafy.backend.domain.Avatar;
import com.ssafy.backend.domain.Product;
import com.ssafy.backend.domain.ProductBottomSize;
import com.ssafy.backend.domain.ProductTopSize;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.RoomItem;
import com.ssafy.backend.domain.RoomParticipant;
import com.ssafy.backend.domain.TryOnJob;
import com.ssafy.backend.domain.TryOnJobItem;
import com.ssafy.backend.domain.User;
import com.ssafy.backend.dto.tryon.OutfitSnapshotConfirmRequestDTO;
import com.ssafy.backend.dto.tryon.OutfitSnapshotResponseDTO;
import com.ssafy.backend.dto.tryon.TryOnGenerationRequest;
import com.ssafy.backend.dto.tryon.TryOnJobCreateRequestDTO;
import com.ssafy.backend.dto.tryon.TryOnJobCreateResponseDTO;
import com.ssafy.backend.dto.tryon.TryOnJobDetailResponseDTO;
import com.ssafy.backend.dto.tryon.TryOnJobRetryResponseDTO;
import com.ssafy.backend.infra.TryOnGenerationClient;
import com.ssafy.backend.repository.AvatarRepository;
import com.ssafy.backend.repository.IdempotencyRecordRepository;
import com.ssafy.backend.repository.ProductBottomSizeRepository;
import com.ssafy.backend.repository.ProductRepository;
import com.ssafy.backend.repository.ProductTopSizeRepository;
import com.ssafy.backend.repository.RoomItemRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.repository.TryOnJobItemRepository;
import com.ssafy.backend.repository.TryOnJobRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.LocalDateTime;
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
class TryOnServiceTest {

    private static final Long MEMBER_ID = 1L;
    private static final Long OTHER_MEMBER_ID = 2L;
    private static final Long AVATAR_ID = 38L;
    private static final Long ROOM_ID = 10L;
    private static final String ROOM_CODE = "A7K9Q2";
    private static final long ROOM_VERSION = 17L;
    private static final Long GENERATED_JOB_ID = 71L;
    private static final String SIZE_NAME = "M";
    private static final LocalDateTime CREATED_AT = LocalDateTime.of(2026, 7, 23, 10, 20);

    @Mock
    private TryOnJobRepository tryOnJobRepository;
    @Mock
    private TryOnJobItemRepository tryOnJobItemRepository;
    @Mock
    private RoomRepository roomRepository;
    @Mock
    private RoomItemRepository roomItemRepository;
    @Mock
    private ProductRepository productRepository;
    @Mock
    private ProductTopSizeRepository productTopSizeRepository;
    @Mock
    private ProductBottomSizeRepository productBottomSizeRepository;
    @Mock
    private AvatarRepository avatarRepository;
    @Mock
    private RoomAuthResolver roomAuthResolver;
    @Mock
    private IdempotencyRecordRepository idempotencyRecordRepository;
    @Mock
    private TryOnGenerationClient tryOnGenerationClient;
    @Mock
    private Authentication authentication;

    private TryOnService tryOnService;

    @BeforeEach
    void setUp() {
        tryOnService = new TryOnService(
                tryOnJobRepository,
                tryOnJobItemRepository,
                roomRepository,
                roomItemRepository,
                productRepository,
                productTopSizeRepository,
                productBottomSizeRepository,
                avatarRepository,
                roomAuthResolver,
                // 해시 계산은 실제 구현을 사용하고 저장소만 대체한다.
                new IdempotencyService(idempotencyRecordRepository, new ObjectMapper()),
                tryOnGenerationClient,
                new TryOnPolicy(20, 1500L, 5, 120_000L, 20, 600_000L)
        );
    }

    /* ==================== 조회 ==================== */

    @Nested
    class Read {

        @Test
        void 성공한_Job은_결과를_담고_error는_null이다() {
            TryOnJob job = soloJob(MEMBER_ID);
            job.setId(GENERATED_JOB_ID);
            job.setCreatedAt(CREATED_AT);
            job.markSucceeded(
                    "https://cdn.example.com/fittings/71.webp",
                    1024,
                    1536,
                    List.of("여유로운 상의 핏"),
                    "생성 이미지는 실제 핏과 다를 수 있습니다.",
                    "provider-model-version",
                    "v1",
                    CREATED_AT.plusSeconds(9)
            );

            when(tryOnJobRepository.findDetailById(GENERATED_JOB_ID)).thenReturn(Optional.of(job));
            when(roomAuthResolver.requireMember(authentication)).thenReturn(member(MEMBER_ID));

            TryOnJobDetailResponseDTO response = tryOnService.read(GENERATED_JOB_ID, authentication);

            assertThat(response.jobId()).isEqualTo(GENERATED_JOB_ID);
            assertThat(response.status()).isEqualTo(TryOnJobStatus.SUCCEEDED.name());
            assertThat(response.error()).isNull();
            assertThat(response.result()).isNotNull();
            assertThat(response.result().imageUrl()).isEqualTo("https://cdn.example.com/fittings/71.webp");
            assertThat(response.result().width()).isEqualTo(1024);
            assertThat(response.result().height()).isEqualTo(1536);
            assertThat(response.result().fitSummary()).containsExactly("여유로운 상의 핏");
            assertThat(response.modelVersion()).isEqualTo("provider-model-version");
            assertThat(response.promptVersion()).isEqualTo("v1");
            assertThat(response.completedAt()).isNotNull();
        }

        @Test
        void 실패한_Job도_예외없이_FAILED와_error를_반환한다() {
            TryOnJob job = soloJob(MEMBER_ID);
            job.setId(GENERATED_JOB_ID);
            job.setCreatedAt(CREATED_AT);
            job.markFailed("GENERATION_TIMEOUT", "생성이 시간 내에 끝나지 않았습니다.", true, CREATED_AT.plusSeconds(30));

            when(tryOnJobRepository.findDetailById(GENERATED_JOB_ID)).thenReturn(Optional.of(job));
            when(roomAuthResolver.requireMember(authentication)).thenReturn(member(MEMBER_ID));

            TryOnJobDetailResponseDTO response = tryOnService.read(GENERATED_JOB_ID, authentication);

            assertThat(response.status()).isEqualTo(TryOnJobStatus.FAILED.name());
            assertThat(response.result()).isNull();
            assertThat(response.error()).isNotNull();
            assertThat(response.error().code()).isEqualTo("GENERATION_TIMEOUT");
            assertThat(response.error().retryable()).isTrue();
        }

        @Test
        void fitSummary가_비어있어도_조회된다() {
            TryOnJob job = soloJob(MEMBER_ID);
            job.setId(GENERATED_JOB_ID);
            job.markSucceeded("url", 1, 1, List.of(), null, null, null, CREATED_AT);

            when(tryOnJobRepository.findDetailById(GENERATED_JOB_ID)).thenReturn(Optional.of(job));
            when(roomAuthResolver.requireMember(authentication)).thenReturn(member(MEMBER_ID));

            TryOnJobDetailResponseDTO response = tryOnService.read(GENERATED_JOB_ID, authentication);

            assertThat(response.result().fitSummary()).isEmpty();
        }

        @Test
        void 존재하지_않는_Job은_RESOURCE_NOT_FOUND() {
            when(tryOnJobRepository.findDetailById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> tryOnService.read(999L, authentication))
                    .isInstanceOf(ApiException.class)
                    .extracting(exception -> ((ApiException) exception).getErrorCode())
                    .isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);
        }

        @Test
        void 다른_회원의_SOLO_Job은_FORBIDDEN() {
            TryOnJob job = soloJob(OTHER_MEMBER_ID);
            job.setId(GENERATED_JOB_ID);

            when(tryOnJobRepository.findDetailById(GENERATED_JOB_ID)).thenReturn(Optional.of(job));
            when(roomAuthResolver.requireMember(authentication)).thenReturn(member(MEMBER_ID));

            assertThatThrownBy(() -> tryOnService.read(GENERATED_JOB_ID, authentication))
                    .isInstanceOf(ApiException.class)
                    .extracting(exception -> ((ApiException) exception).getErrorCode())
                    .isEqualTo(ErrorCode.FORBIDDEN);
        }

        @Test
        void ROOM_Job은_방_참가자_검증을_거친다() {
            Room room = room(ROOM_VERSION);
            TryOnJob job = TryOnJob.builder()
                    .contextType(TryOnContextType.ROOM.name())
                    .room(room)
                    .ownerUser(member(MEMBER_ID))
                    .avatar(avatar())
                    .status(TryOnJobStatus.QUEUED.name())
                    .build();
            job.setId(GENERATED_JOB_ID);

            when(tryOnJobRepository.findDetailById(GENERATED_JOB_ID)).thenReturn(Optional.of(job));
            when(roomAuthResolver.requireParticipant(authentication, room))
                    .thenReturn(participant(RoomRole.PARTICIPANTS));

            TryOnJobDetailResponseDTO response = tryOnService.read(GENERATED_JOB_ID, authentication);

            assertThat(response.status()).isEqualTo(TryOnJobStatus.QUEUED.name());
            verify(roomAuthResolver).requireParticipant(authentication, room);
        }
    }

    /* ==================== 등록 ==================== */

    @Nested
    class Create {

        @Test
        void SOLO_등록은_QUEUED로_저장하고_생성을_접수시킨다() {
            when(roomAuthResolver.requireMember(authentication)).thenReturn(member(MEMBER_ID));
            when(avatarRepository.findById(AVATAR_ID)).thenReturn(Optional.of(avatar()));
            when(productRepository.findById(500L)).thenReturn(Optional.of(product(500L)));
            stubTopSize(500L);
            when(tryOnJobRepository.findLatestSucceededByRequestHash(anyString())).thenReturn(Optional.empty());
            when(tryOnJobRepository.countByOwnerUserIdAndCreatedAtGreaterThanEqual(anyLong(), any()))
                    .thenReturn(0L);
            stubJobSave();

            TryOnJobCreateResponseDTO response = tryOnService.create(
                    soloRequest(500L, "TOP"), null, authentication);

            assertThat(response.jobId()).isEqualTo(GENERATED_JOB_ID);
            assertThat(response.status()).isEqualTo(TryOnJobStatus.QUEUED.name());
            assertThat(response.cacheHit()).isFalse();
            assertThat(response.pollAfterMs()).isEqualTo(1500L);

            ArgumentCaptor<TryOnGenerationRequest> submitted =
                    ArgumentCaptor.forClass(TryOnGenerationRequest.class);
            verify(tryOnGenerationClient).submit(submitted.capture());
            assertThat(submitted.getValue().jobId()).isEqualTo(GENERATED_JOB_ID);
            assertThat(submitted.getValue().items()).hasSize(1);
            assertThat(submitted.getValue().items().getFirst().slot()).isEqualTo("TOP");
        }

        @Test
        void 상의는_선택한_사이즈의_실측을_보낸다() {
            when(roomAuthResolver.requireMember(authentication)).thenReturn(member(MEMBER_ID));
            when(avatarRepository.findById(AVATAR_ID)).thenReturn(Optional.of(avatar()));
            when(productRepository.findById(500L)).thenReturn(Optional.of(product(500L)));
            stubTopSize(500L);
            when(tryOnJobRepository.countByOwnerUserIdAndCreatedAtGreaterThanEqual(anyLong(), any()))
                    .thenReturn(0L);
            stubJobSave();

            tryOnService.create(soloRequest(500L, "TOP"), null, authentication);

            TryOnGenerationRequest.SizeProfile sent = capturedItem().sizeProfile();
            assertThat(sent.sizeName()).isEqualTo(SIZE_NAME);
            assertThat(sent.totalLength()).isEqualByComparingTo("72.00");
            assertThat(sent.shoulderWidth()).isEqualByComparingTo("52.00");
            assertThat(sent.chestWidth()).isEqualByComparingTo("60.00");
            assertThat(sent.sleeveLength()).isEqualByComparingTo("61.00");
            // 상의에는 하의 항목이 실리지 않는다.
            assertThat(sent.waistWidth()).isNull();
            assertThat(sent.rise()).isNull();
        }

        @Test
        void 하의는_하의_실측_항목을_보낸다() {
            when(roomAuthResolver.requireMember(authentication)).thenReturn(member(MEMBER_ID));
            when(avatarRepository.findById(AVATAR_ID)).thenReturn(Optional.of(avatar()));
            when(productRepository.findById(600L)).thenReturn(Optional.of(product(600L)));
            when(productBottomSizeRepository.findByProductIdAndSizeName(600L, SIZE_NAME))
                    .thenReturn(Optional.of(bottomSize(600L)));
            when(tryOnJobRepository.countByOwnerUserIdAndCreatedAtGreaterThanEqual(anyLong(), any()))
                    .thenReturn(0L);
            stubJobSave();

            tryOnService.create(soloRequest(600L, "BOTTOM"), null, authentication);

            TryOnGenerationRequest.SizeProfile sent = capturedItem().sizeProfile();
            assertThat(sent.sizeName()).isEqualTo(SIZE_NAME);
            assertThat(sent.totalLength()).isEqualByComparingTo("102.00");
            assertThat(sent.waistWidth()).isEqualByComparingTo("30.25");
            assertThat(sent.hipWidth()).isEqualByComparingTo("41.75");
            assertThat(sent.thighWidth()).isEqualByComparingTo("26.63");
            assertThat(sent.rise()).isEqualByComparingTo("27.50");
            // 하의에는 상의 항목이 실리지 않는다.
            assertThat(sent.shoulderWidth()).isNull();
            assertThat(sent.sleeveLength()).isNull();
        }

        @Test
        void 없는_사이즈는_선택_가능한_사이즈를_알려주며_BAD_REQUEST() {
            when(roomAuthResolver.requireMember(authentication)).thenReturn(member(MEMBER_ID));
            when(avatarRepository.findById(AVATAR_ID)).thenReturn(Optional.of(avatar()));
            when(productRepository.findById(500L)).thenReturn(Optional.of(product(500L)));
            when(productTopSizeRepository.findByProductIdAndSizeName(500L, SIZE_NAME))
                    .thenReturn(Optional.empty());
            when(productTopSizeRepository.findAllByProductId(500L))
                    .thenReturn(List.of(topSize(500L)));

            TryOnJobCreateRequestDTO request = soloRequest(500L, "TOP");

            assertThatThrownBy(() -> tryOnService.create(request, null, authentication))
                    .isInstanceOf(ApiException.class)
                    .satisfies(thrown -> {
                        ApiException exception = (ApiException) thrown;
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.BAD_REQUEST);
                        assertThat(exception.getDetails()).containsEntry("availableSizes", List.of(SIZE_NAME));
                    });

            verify(tryOnGenerationClient, never()).submit(any());
        }

        @Test
        void 아바타_구간이_실제_cm_kg_범위로_전달된다() {
            when(roomAuthResolver.requireMember(authentication)).thenReturn(member(MEMBER_ID));
            when(avatarRepository.findById(AVATAR_ID)).thenReturn(Optional.of(avatar()));
            when(productRepository.findById(500L)).thenReturn(Optional.of(product(500L)));
            stubTopSize(500L);
            when(tryOnJobRepository.countByOwnerUserIdAndCreatedAtGreaterThanEqual(anyLong(), any()))
                    .thenReturn(0L);
            stubJobSave();

            tryOnService.create(soloRequest(500L, "TOP"), null, authentication);

            TryOnGenerationRequest.Avatar sent = capturedRequest().avatar();
            assertThat(sent.gender()).isEqualTo("FEMALE");
            assertThat(sent.bodyType()).isEqualTo("STANDARD");
            // heightId=3 -> 160~170, weightId=2 -> 50~60
            assertThat(sent.minHeight()).isEqualTo(160);
            assertThat(sent.maxHeight()).isEqualTo(170);
            assertThat(sent.minWeight()).isEqualTo(50);
            assertThat(sent.maxWeight()).isEqualTo(60);
        }

        @Test
        void SOLO_컨텍스트는_roomId와_boardVersion이_비어_전달된다() {
            when(roomAuthResolver.requireMember(authentication)).thenReturn(member(MEMBER_ID));
            when(avatarRepository.findById(AVATAR_ID)).thenReturn(Optional.of(avatar()));
            when(productRepository.findById(500L)).thenReturn(Optional.of(product(500L)));
            stubTopSize(500L);
            when(tryOnJobRepository.countByOwnerUserIdAndCreatedAtGreaterThanEqual(anyLong(), any()))
                    .thenReturn(0L);
            stubJobSave();

            tryOnService.create(soloRequest(500L, "TOP"), null, authentication);

            TryOnGenerationRequest.Context sent = capturedRequest().context();
            assertThat(sent.type()).isEqualTo(TryOnContextType.SOLO.name());
            assertThat(sent.roomId()).isNull();
            assertThat(sent.boardVersion()).isNull();
        }

        @Test
        void 동일_구성_성공_Job이_있으면_재생성하지_않고_결과를_재사용한다() {
            TryOnJob cached = soloJob(OTHER_MEMBER_ID);
            cached.markSucceeded("https://cdn/cached.webp", 1024, 1536, List.of("핏"),
                    "안내", "model-1", "v1", CREATED_AT);

            when(roomAuthResolver.requireMember(authentication)).thenReturn(member(MEMBER_ID));
            when(avatarRepository.findById(AVATAR_ID)).thenReturn(Optional.of(avatar()));
            when(productRepository.findById(500L)).thenReturn(Optional.of(product(500L)));
            stubTopSize(500L);
            when(tryOnJobRepository.findLatestSucceededByRequestHash(anyString()))
                    .thenReturn(Optional.of(cached));
            when(tryOnJobRepository.countByOwnerUserIdAndCreatedAtGreaterThanEqual(anyLong(), any()))
                    .thenReturn(0L);
            stubJobSave();

            TryOnJobCreateResponseDTO response = tryOnService.create(
                    soloRequest(500L, "TOP"), null, authentication);

            assertThat(response.cacheHit()).isTrue();
            assertThat(response.status()).isEqualTo(TryOnJobStatus.SUCCEEDED.name());
            verify(tryOnGenerationClient, never()).submit(any());
        }

        @Test
        void 게스트도_방에서는_착장을_등록할_수_있다() {
            Room room = room(ROOM_VERSION);
            RoomParticipant guest = participant(RoomRole.PARTICIPANTS);

            when(roomRepository.findByRoomCode(ROOM_CODE)).thenReturn(Optional.of(room));
            when(roomAuthResolver.requireParticipant(authentication, room)).thenReturn(guest);
            // 비회원이라 회원으로 해석되지 않는다.
            when(roomAuthResolver.findMember(authentication)).thenReturn(Optional.empty());
            when(avatarRepository.findById(AVATAR_ID)).thenReturn(Optional.of(avatar()));
            when(roomItemRepository.findById(91L)).thenReturn(Optional.of(roomItem(91L, room)));
            stubTopSize(500L);
            when(tryOnJobRepository.countByOwnerParticipantIdAndCreatedAtGreaterThanEqual(
                    eq(guest.getId()), any())).thenReturn(0L);
            stubJobSave();

            TryOnJobCreateResponseDTO response =
                    tryOnService.create(roomRequest(ROOM_VERSION, 91L, "TOP"), null, authentication);

            assertThat(response.status()).isEqualTo(TryOnJobStatus.QUEUED.name());

            ArgumentCaptor<TryOnJob> saved = ArgumentCaptor.forClass(TryOnJob.class);
            verify(tryOnJobRepository).save(saved.capture());
            assertThat(saved.getValue().getOwnerUser()).isNull();
            assertThat(saved.getValue().getOwnerParticipant()).isSameAs(guest);
            // 회원이 아니므로 한도는 참가자 기준으로 센다.
            verify(tryOnJobRepository).countByOwnerParticipantIdAndCreatedAtGreaterThanEqual(
                    eq(guest.getId()), any());
            verify(tryOnJobRepository, never())
                    .countByOwnerUserIdAndCreatedAtGreaterThanEqual(anyLong(), any());
        }

        @Test
        void 게스트가_한도를_넘으면_GENERATION_QUOTA_EXCEEDED() {
            Room room = room(ROOM_VERSION);
            RoomParticipant guest = participant(RoomRole.PARTICIPANTS);

            when(roomRepository.findByRoomCode(ROOM_CODE)).thenReturn(Optional.of(room));
            when(roomAuthResolver.requireParticipant(authentication, room)).thenReturn(guest);
            when(roomAuthResolver.findMember(authentication)).thenReturn(Optional.empty());
            when(avatarRepository.findById(AVATAR_ID)).thenReturn(Optional.of(avatar()));
            when(roomItemRepository.findById(91L)).thenReturn(Optional.of(roomItem(91L, room)));
            stubTopSize(500L);
            when(tryOnJobRepository.countByOwnerParticipantIdAndCreatedAtGreaterThanEqual(
                    eq(guest.getId()), any())).thenReturn(20L);

            TryOnJobCreateRequestDTO request = roomRequest(ROOM_VERSION, 91L, "TOP");

            assertThatThrownBy(() -> tryOnService.create(request, null, authentication))
                    .isInstanceOf(ApiException.class)
                    .extracting(exception -> ((ApiException) exception).getErrorCode())
                    .isEqualTo(ErrorCode.GENERATION_QUOTA_EXCEEDED);
        }

        @Test
        void SOLO_는_게스트가_등록할_수_없다() {
            when(roomAuthResolver.requireMember(authentication))
                    .thenThrow(new ApiException(ErrorCode.UNAUTHORIZED));

            TryOnJobCreateRequestDTO request = soloRequest(500L, "TOP");

            assertThatThrownBy(() -> tryOnService.create(request, null, authentication))
                    .isInstanceOf(ApiException.class)
                    .extracting(exception -> ((ApiException) exception).getErrorCode())
                    .isEqualTo(ErrorCode.UNAUTHORIZED);
        }

        @Test
        void ROOM_등록은_보드_버전이_다르면_VERSION_CONFLICT() {
            Room room = room(ROOM_VERSION);
            when(roomRepository.findByRoomCode(ROOM_CODE)).thenReturn(Optional.of(room));
            when(roomAuthResolver.requireParticipant(authentication, room))
                    .thenReturn(participant(RoomRole.PARTICIPANTS));

            TryOnJobCreateRequestDTO request = roomRequest(ROOM_VERSION + 1, 91L, "TOP");

            assertThatThrownBy(() -> tryOnService.create(request, null, authentication))
                    .isInstanceOf(ApiException.class)
                    .extracting(exception -> ((ApiException) exception).getErrorCode())
                    .isEqualTo(ErrorCode.VERSION_CONFLICT);

            verify(tryOnGenerationClient, never()).submit(any());
        }

        @Test
        void ROOM_등록은_다른_방의_후보_의상이면_FORBIDDEN() {
            Room room = room(ROOM_VERSION);
            Room otherRoom = room(ROOM_VERSION);
            otherRoom.setId(ROOM_ID + 1);

            when(roomRepository.findByRoomCode(ROOM_CODE)).thenReturn(Optional.of(room));
            when(roomAuthResolver.requireParticipant(authentication, room))
                    .thenReturn(participant(RoomRole.PARTICIPANTS));
            when(avatarRepository.findById(AVATAR_ID)).thenReturn(Optional.of(avatar()));
            when(roomItemRepository.findById(91L)).thenReturn(Optional.of(roomItem(91L, otherRoom)));

            TryOnJobCreateRequestDTO request = roomRequest(ROOM_VERSION, 91L, "TOP");

            assertThatThrownBy(() -> tryOnService.create(request, null, authentication))
                    .isInstanceOf(ApiException.class)
                    .extracting(exception -> ((ApiException) exception).getErrorCode())
                    .isEqualTo(ErrorCode.FORBIDDEN);
        }

        @Test
        void 일일_한도를_넘으면_GENERATION_QUOTA_EXCEEDED() {
            when(roomAuthResolver.requireMember(authentication)).thenReturn(member(MEMBER_ID));
            when(avatarRepository.findById(AVATAR_ID)).thenReturn(Optional.of(avatar()));
            when(productRepository.findById(500L)).thenReturn(Optional.of(product(500L)));
            stubTopSize(500L);
            when(tryOnJobRepository.countByOwnerUserIdAndCreatedAtGreaterThanEqual(anyLong(), any()))
                    .thenReturn(20L);

            TryOnJobCreateRequestDTO request = soloRequest(500L, "TOP");

            assertThatThrownBy(() -> tryOnService.create(request, null, authentication))
                    .isInstanceOf(ApiException.class)
                    .extracting(exception -> ((ApiException) exception).getErrorCode())
                    .isEqualTo(ErrorCode.GENERATION_QUOTA_EXCEEDED);

            verify(tryOnJobRepository, never()).save(any());
        }

        @Test
        void 허용되지_않은_slot은_BAD_REQUEST() {
            when(roomAuthResolver.requireMember(authentication)).thenReturn(member(MEMBER_ID));
            when(avatarRepository.findById(AVATAR_ID)).thenReturn(Optional.of(avatar()));

            TryOnJobCreateRequestDTO request = soloRequest(500L, "HAT");

            assertThatThrownBy(() -> tryOnService.create(request, null, authentication))
                    .isInstanceOf(ApiException.class)
                    .extracting(exception -> ((ApiException) exception).getErrorCode())
                    .isEqualTo(ErrorCode.BAD_REQUEST);
        }

        @Test
        void 아우터는_착장에_사용할_수_없다() {
            when(roomAuthResolver.requireMember(authentication)).thenReturn(member(MEMBER_ID));
            when(avatarRepository.findById(AVATAR_ID)).thenReturn(Optional.of(avatar()));

            TryOnJobCreateRequestDTO request = soloRequest(500L, "OUTER");

            assertThatThrownBy(() -> tryOnService.create(request, null, authentication))
                    .isInstanceOf(ApiException.class)
                    .satisfies(thrown -> {
                        ApiException exception = (ApiException) thrown;
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.BAD_REQUEST);
                        assertThat(exception.getDetails())
                                .containsEntry("slot", "OUTER")
                                .containsEntry("supportedSlots", List.of("TOP", "BOTTOM"));
                    });

            verify(tryOnGenerationClient, never()).submit(any());
        }

        @Test
        void 신발도_착장에_사용할_수_없다() {
            when(roomAuthResolver.requireMember(authentication)).thenReturn(member(MEMBER_ID));
            when(avatarRepository.findById(AVATAR_ID)).thenReturn(Optional.of(avatar()));

            TryOnJobCreateRequestDTO request = soloRequest(500L, "SHOES");

            assertThatThrownBy(() -> tryOnService.create(request, null, authentication))
                    .isInstanceOf(ApiException.class)
                    .extracting(exception -> ((ApiException) exception).getErrorCode())
                    .isEqualTo(ErrorCode.BAD_REQUEST);
        }

        @Test
        void 같은_slot이_중복되면_BAD_REQUEST() {
            when(roomAuthResolver.requireMember(authentication)).thenReturn(member(MEMBER_ID));
            when(avatarRepository.findById(AVATAR_ID)).thenReturn(Optional.of(avatar()));
            when(productRepository.findById(500L)).thenReturn(Optional.of(product(500L)));

            TryOnJobCreateRequestDTO request = new TryOnJobCreateRequestDTO(
                    new TryOnJobCreateRequestDTO.Context(TryOnContextType.SOLO.name(), null, null),
                    AVATAR_ID,
                    List.of(
                            new TryOnJobCreateRequestDTO.Item(null, 500L, "TOP", "M"),
                            new TryOnJobCreateRequestDTO.Item(null, 501L, "TOP", "M")
                    ),
                    null,
                    null
            );

            assertThatThrownBy(() -> tryOnService.create(request, null, authentication))
                    .isInstanceOf(ApiException.class)
                    .extracting(exception -> ((ApiException) exception).getErrorCode())
                    .isEqualTo(ErrorCode.BAD_REQUEST);
        }

        @Test
        void 알_수_없는_컨텍스트_타입은_BAD_REQUEST() {
            TryOnJobCreateRequestDTO request = new TryOnJobCreateRequestDTO(
                    new TryOnJobCreateRequestDTO.Context("PARTY", null, null),
                    AVATAR_ID,
                    List.of(new TryOnJobCreateRequestDTO.Item(null, 500L, "TOP", "M")),
                    null,
                    null
            );

            assertThatThrownBy(() -> tryOnService.create(request, null, authentication))
                    .isInstanceOf(ApiException.class)
                    .extracting(exception -> ((ApiException) exception).getErrorCode())
                    .isEqualTo(ErrorCode.BAD_REQUEST);
        }

        @Test
        void 존재하지_않는_아바타는_AVATAR_NOT_FOUND() {
            when(roomAuthResolver.requireMember(authentication)).thenReturn(member(MEMBER_ID));
            when(avatarRepository.findById(AVATAR_ID)).thenReturn(Optional.empty());

            TryOnJobCreateRequestDTO request = soloRequest(500L, "TOP");

            assertThatThrownBy(() -> tryOnService.create(request, null, authentication))
                    .isInstanceOf(ApiException.class)
                    .extracting(exception -> ((ApiException) exception).getErrorCode())
                    .isEqualTo(ErrorCode.AVATAR_NOT_FOUND);
        }
    }

    /* ==================== 재시도 ==================== */

    @Nested
    class Retry {

        @Test
        void 재시도_가능한_실패_Job은_원본을_가리키는_새_Job이_된다() {
            TryOnJob source = soloJob(MEMBER_ID);
            source.setId(GENERATED_JOB_ID);
            source.setRequestHash("hash-1");
            source.markFailed("GENERATION_TIMEOUT", "타임아웃", true, CREATED_AT);

            when(tryOnJobRepository.findDetailById(GENERATED_JOB_ID)).thenReturn(Optional.of(source));
            when(roomAuthResolver.requireMember(authentication)).thenReturn(member(MEMBER_ID));
            when(tryOnJobRepository.countByOwnerUserIdAndCreatedAtGreaterThanEqual(anyLong(), any()))
                    .thenReturn(0L);
            when(tryOnJobItemRepository.findAllByTryOnJobIdWithProduct(GENERATED_JOB_ID))
                    .thenReturn(List.of(jobItem(source, 500L, "TOP")));
            stubTopSize(500L);
            stubJobSave(GENERATED_JOB_ID + 1);

            TryOnJobRetryResponseDTO response = tryOnService.retry(GENERATED_JOB_ID, null, authentication);

            assertThat(response.jobId()).isEqualTo(GENERATED_JOB_ID + 1);
            assertThat(response.retryOfJobId()).isEqualTo(GENERATED_JOB_ID);
            assertThat(response.status()).isEqualTo(TryOnJobStatus.QUEUED.name());
            assertThat(response.cacheHit()).isFalse();
            verify(tryOnGenerationClient).submit(any());
        }

        @Test
        void retryable이_아닌_실패는_JOB_NOT_RETRYABLE() {
            TryOnJob source = soloJob(MEMBER_ID);
            source.setId(GENERATED_JOB_ID);
            source.markFailed("INVALID_INPUT", "잘못된 입력", false, CREATED_AT);

            when(tryOnJobRepository.findDetailById(GENERATED_JOB_ID)).thenReturn(Optional.of(source));
            when(roomAuthResolver.requireMember(authentication)).thenReturn(member(MEMBER_ID));

            assertThatThrownBy(() -> tryOnService.retry(GENERATED_JOB_ID, null, authentication))
                    .isInstanceOf(ApiException.class)
                    .extracting(exception -> ((ApiException) exception).getErrorCode())
                    .isEqualTo(ErrorCode.JOB_NOT_RETRYABLE);

            verify(tryOnGenerationClient, never()).submit(any());
        }

        @Test
        void 아직_끝나지_않은_Job은_JOB_NOT_RETRYABLE() {
            TryOnJob source = soloJob(MEMBER_ID);
            source.setId(GENERATED_JOB_ID);

            when(tryOnJobRepository.findDetailById(GENERATED_JOB_ID)).thenReturn(Optional.of(source));
            when(roomAuthResolver.requireMember(authentication)).thenReturn(member(MEMBER_ID));

            assertThatThrownBy(() -> tryOnService.retry(GENERATED_JOB_ID, null, authentication))
                    .isInstanceOf(ApiException.class)
                    .extracting(exception -> ((ApiException) exception).getErrorCode())
                    .isEqualTo(ErrorCode.JOB_NOT_RETRYABLE);
        }
    }

    /* ==================== 방 확정 스냅샷 ==================== */

    @Nested
    class ConfirmSnapshot {

        @Test
        void HOST가_성공한_Job을_확정하면_방_버전이_증가한다() {
            Room room = room(ROOM_VERSION);
            TryOnJob job = roomJob(room);
            job.markSucceeded("https://cdn/71.webp", 1024, 1536, List.of(), null, "m", "v1", CREATED_AT);

            when(roomRepository.findByRoomCodeForUpdate(ROOM_CODE)).thenReturn(Optional.of(room));
            when(roomAuthResolver.requireParticipant(authentication, room))
                    .thenReturn(participant(RoomRole.HOST));
            when(tryOnJobRepository.findDetailById(GENERATED_JOB_ID)).thenReturn(Optional.of(job));
            when(roomRepository.saveAndFlush(room)).thenAnswer(invocation -> {
                Room saved = invocation.getArgument(0);
                // 실제 환경에서는 flush 시 @Version 이 증가한다.
                saved.setVersion(saved.getVersion() + 1);
                return saved;
            });

            OutfitSnapshotResponseDTO response = tryOnService.confirmSnapshot(
                    ROOM_CODE,
                    new OutfitSnapshotConfirmRequestDTO(GENERATED_JOB_ID, ROOM_VERSION),
                    authentication
            );

            assertThat(response.roomCode()).isEqualTo(ROOM_CODE);
            assertThat(response.confirmedTryOnJobId()).isEqualTo(GENERATED_JOB_ID);
            assertThat(response.version()).isEqualTo(ROOM_VERSION + 1);
            assertThat(room.getConfirmedTryOnJob()).isSameAs(job);
            verify(roomAuthResolver).requireHost(any(RoomParticipant.class));
        }

        @Test
        void 보드_버전이_다르면_VERSION_CONFLICT() {
            Room room = room(ROOM_VERSION);

            when(roomRepository.findByRoomCodeForUpdate(ROOM_CODE)).thenReturn(Optional.of(room));
            when(roomAuthResolver.requireParticipant(authentication, room))
                    .thenReturn(participant(RoomRole.HOST));

            OutfitSnapshotConfirmRequestDTO request =
                    new OutfitSnapshotConfirmRequestDTO(GENERATED_JOB_ID, ROOM_VERSION - 1);

            assertThatThrownBy(() -> tryOnService.confirmSnapshot(ROOM_CODE, request, authentication))
                    .isInstanceOf(ApiException.class)
                    .extracting(exception -> ((ApiException) exception).getErrorCode())
                    .isEqualTo(ErrorCode.VERSION_CONFLICT);

            verify(roomRepository, never()).saveAndFlush(any());
        }

        @Test
        void 성공하지_않은_Job은_확정할_수_없다() {
            Room room = room(ROOM_VERSION);
            TryOnJob job = roomJob(room);

            when(roomRepository.findByRoomCodeForUpdate(ROOM_CODE)).thenReturn(Optional.of(room));
            when(roomAuthResolver.requireParticipant(authentication, room))
                    .thenReturn(participant(RoomRole.HOST));
            when(tryOnJobRepository.findDetailById(GENERATED_JOB_ID)).thenReturn(Optional.of(job));

            OutfitSnapshotConfirmRequestDTO request =
                    new OutfitSnapshotConfirmRequestDTO(GENERATED_JOB_ID, ROOM_VERSION);

            assertThatThrownBy(() -> tryOnService.confirmSnapshot(ROOM_CODE, request, authentication))
                    .isInstanceOf(ApiException.class)
                    .extracting(exception -> ((ApiException) exception).getErrorCode())
                    .isEqualTo(ErrorCode.CONFLICT);
        }

        @Test
        void 다른_방의_Job은_확정할_수_없다() {
            Room room = room(ROOM_VERSION);
            Room otherRoom = room(ROOM_VERSION);
            otherRoom.setId(ROOM_ID + 1);

            TryOnJob job = roomJob(otherRoom);
            job.markSucceeded("url", 1, 1, List.of(), null, "m", "v1", CREATED_AT);

            when(roomRepository.findByRoomCodeForUpdate(ROOM_CODE)).thenReturn(Optional.of(room));
            when(roomAuthResolver.requireParticipant(authentication, room))
                    .thenReturn(participant(RoomRole.HOST));
            when(tryOnJobRepository.findDetailById(GENERATED_JOB_ID)).thenReturn(Optional.of(job));

            OutfitSnapshotConfirmRequestDTO request =
                    new OutfitSnapshotConfirmRequestDTO(GENERATED_JOB_ID, ROOM_VERSION);

            assertThatThrownBy(() -> tryOnService.confirmSnapshot(ROOM_CODE, request, authentication))
                    .isInstanceOf(ApiException.class)
                    .extracting(exception -> ((ApiException) exception).getErrorCode())
                    .isEqualTo(ErrorCode.FORBIDDEN);
        }

        @Test
        void 종료된_방은_ROOM_CLOSED() {
            Room room = room(ROOM_VERSION);
            room.setFinishedAt(CREATED_AT);

            when(roomRepository.findByRoomCodeForUpdate(ROOM_CODE)).thenReturn(Optional.of(room));

            OutfitSnapshotConfirmRequestDTO request =
                    new OutfitSnapshotConfirmRequestDTO(GENERATED_JOB_ID, ROOM_VERSION);

            assertThatThrownBy(() -> tryOnService.confirmSnapshot(ROOM_CODE, request, authentication))
                    .isInstanceOf(ApiException.class)
                    .extracting(exception -> ((ApiException) exception).getErrorCode())
                    .isEqualTo(ErrorCode.ROOM_CLOSED);
        }

        @Test
        void 없는_방은_ROOM_NOT_FOUND() {
            when(roomRepository.findByRoomCodeForUpdate(ROOM_CODE)).thenReturn(Optional.empty());

            OutfitSnapshotConfirmRequestDTO request =
                    new OutfitSnapshotConfirmRequestDTO(GENERATED_JOB_ID, ROOM_VERSION);

            assertThatThrownBy(() -> tryOnService.confirmSnapshot(ROOM_CODE, request, authentication))
                    .isInstanceOf(ApiException.class)
                    .extracting(exception -> ((ApiException) exception).getErrorCode())
                    .isEqualTo(ErrorCode.ROOM_NOT_FOUND);
        }
    }

    /* ==================== 픽스처 ==================== */

    private void stubJobSave() {
        stubJobSave(GENERATED_JOB_ID);
    }

    private void stubJobSave(Long assignedId) {
        when(tryOnJobRepository.save(any(TryOnJob.class))).thenAnswer(invocation -> {
            TryOnJob job = invocation.getArgument(0);
            job.setId(assignedId);
            job.setCreatedAt(CREATED_AT);
            return job;
        });
    }

    private User member(Long id) {
        return User.builder()
                .id(id)
                .email("member" + id + "@example.com")
                .password("encoded")
                .nickname("회원" + id)
                .build();
    }

    private Avatar avatar() {
        return Avatar.builder()
                .id(AVATAR_ID)
                .gender("FEMALE")
                .bodyType("STANDARD")
                .imageUrl("https://cdn.example.com/avatars/38.webp")
                .heightId(3L)
                .weightId(2L)
                .build();
    }

    private Product product(Long id) {
        return Product.builder()
                .id(id)
                .name("상품" + id)
                .brand("브랜드")
                .price(39000)
                .category("TOP")
                .subcategory("SHIRT")
                .imageUrl("https://cdn.example.com/products/" + id + ".webp")
                .purchaseUrl("https://shop.example.com/" + id)
                .build();
    }

    private Room room(long version) {
        Room room = Room.builder()
                .id(ROOM_ID)
                .roomCode(ROOM_CODE)
                .maxParticipants(6)
                .idempotencyKey("room-key")
                .recommendationVersion(1L)
                .expiresAt(LocalDateTime.now().plusHours(1))
                .build();
        room.setVersion(version);
        return room;
    }

    private RoomItem roomItem(Long id, Room room) {
        return RoomItem.builder()
                .id(id)
                .room(room)
                .product(product(500L))
                .position(0)
                .build();
    }

    private RoomParticipant participant(RoomRole role) {
        return RoomParticipant.builder()
                .id(77L)
                .nickname("참가자")
                .role(role.name())
                .build();
    }

    private TryOnJob soloJob(Long ownerId) {
        return TryOnJob.builder()
                .contextType(TryOnContextType.SOLO.name())
                .ownerUser(member(ownerId))
                .avatar(avatar())
                .status(TryOnJobStatus.QUEUED.name())
                .build();
    }

    private TryOnJob roomJob(Room room) {
        TryOnJob job = TryOnJob.builder()
                .contextType(TryOnContextType.ROOM.name())
                .room(room)
                .ownerUser(member(MEMBER_ID))
                .avatar(avatar())
                .status(TryOnJobStatus.QUEUED.name())
                .build();
        job.setId(GENERATED_JOB_ID);
        return job;
    }

    private TryOnJobItem jobItem(TryOnJob job, Long productId, String slot) {
        return TryOnJobItem.builder()
                .id(900L)
                .tryOnJob(job)
                .product(product(productId))
                .slot(slot)
                .sizeName(SIZE_NAME)
                .position(0)
                .build();
    }

    private TryOnJobCreateRequestDTO soloRequest(Long productId, String slot) {
        return new TryOnJobCreateRequestDTO(
                new TryOnJobCreateRequestDTO.Context(TryOnContextType.SOLO.name(), null, null),
                AVATAR_ID,
                List.of(new TryOnJobCreateRequestDTO.Item(null, productId, slot, SIZE_NAME)),
                new TryOnJobCreateRequestDTO.WearOptions("UNTUCKED", "OPEN", "NORMAL"),
                null
        );
    }

    private TryOnJobCreateRequestDTO roomRequest(long boardVersion, Long roomItemId, String slot) {
        return new TryOnJobCreateRequestDTO(
                new TryOnJobCreateRequestDTO.Context(
                        TryOnContextType.ROOM.name(), ROOM_CODE, boardVersion),
                AVATAR_ID,
                List.of(new TryOnJobCreateRequestDTO.Item(roomItemId, null, slot, SIZE_NAME)),
                null,
                null
        );
    }

    private ProductTopSize topSize(Long productId) {
        return ProductTopSize.builder()
                .id(1L)
                .product(product(productId))
                .sizeName(SIZE_NAME)
                .totalLength(new BigDecimal("72.00"))
                .shoulderWidth(new BigDecimal("52.00"))
                .chestWidth(new BigDecimal("60.00"))
                .sleeveLength(new BigDecimal("61.00"))
                .build();
    }

    private ProductBottomSize bottomSize(Long productId) {
        return ProductBottomSize.builder()
                .id(2L)
                .product(product(productId))
                .sizeName(SIZE_NAME)
                .totalLength(new BigDecimal("102.00"))
                .waistWidth(new BigDecimal("30.25"))
                .hipWidth(new BigDecimal("41.75"))
                .thighWidth(new BigDecimal("26.63"))
                .rise(new BigDecimal("27.50"))
                .build();
    }

    // 상의 사이즈 조회를 통과시킨다. slot=TOP 인 요청은 모두 이 스텁이 필요하다.
    private void stubTopSize(Long productId) {
        when(productTopSizeRepository.findByProductIdAndSizeName(productId, SIZE_NAME))
                .thenReturn(Optional.of(topSize(productId)));
    }

    private TryOnGenerationRequest capturedRequest() {
        ArgumentCaptor<TryOnGenerationRequest> submitted =
                ArgumentCaptor.forClass(TryOnGenerationRequest.class);
        verify(tryOnGenerationClient).submit(submitted.capture());
        return submitted.getValue();
    }

    private TryOnGenerationRequest.Item capturedItem() {
        return capturedRequest().items().getFirst();
    }
}
