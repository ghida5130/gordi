package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.config.TryOnPolicy;
import com.ssafy.backend.config.enums.CategoryCode;
import com.ssafy.backend.config.enums.HeightRange;
import com.ssafy.backend.config.enums.OuterClosure;
import com.ssafy.backend.config.enums.Sleeves;
import com.ssafy.backend.config.enums.TopTuck;
import com.ssafy.backend.config.enums.TryOnContextType;
import com.ssafy.backend.config.enums.TryOnJobStatus;
import com.ssafy.backend.config.enums.WeightRange;
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
import com.ssafy.backend.repository.ProductBottomSizeRepository;
import com.ssafy.backend.repository.ProductRepository;
import com.ssafy.backend.repository.ProductTopSizeRepository;
import com.ssafy.backend.repository.RoomItemRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.repository.TryOnJobItemRepository;
import com.ssafy.backend.repository.TryOnJobRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * 착장 이미지 생성 Job 등록·조회·재시도와 방 확정 스냅샷 지정.
 * <p>
 * 생성 결과를 되돌려 받는 경로가 아직 확정되지 않아, 이 Service 는 Job 을 QUEUED 로 남기고
 * {@link TryOnGenerationClient} 로 접수만 시킨다. 완료 처리(SUCCEEDED/FAILED 전이)는
 * {@link TryOnJob#markSucceeded} / {@link TryOnJob#markFailed} 를 호출하는 별도 진입점에서 담당한다.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class TryOnService {

    private static final Logger log = LoggerFactory.getLogger(TryOnService.class);

    private static final String CREATE_ENDPOINT = "POST /api/v1/try-on-jobs";
    private static final String RETRY_ENDPOINT = "POST /api/v1/try-on-jobs/{jobId}/retry";

    /**
     * 멱등 기록의 추천 참조 값.
     * {@code IdempotencyRecord.recommendationId / recommendationVersion} 이 nullable = false 인데
     * 착장 Job 은 추천 스냅샷에 종속되지 않으므로 "참조 없음"을 뜻하는 값으로 기록한다.
     */
    private static final long NO_RECOMMENDATION = 0L;

    private final TryOnJobRepository tryOnJobRepository;
    private final TryOnJobItemRepository tryOnJobItemRepository;
    private final RoomRepository roomRepository;
    private final RoomItemRepository roomItemRepository;
    private final ProductRepository productRepository;
    private final ProductTopSizeRepository productTopSizeRepository;
    private final ProductBottomSizeRepository productBottomSizeRepository;
    private final AvatarRepository avatarRepository;
    private final RoomAuthResolver roomAuthResolver;
    private final IdempotencyService idempotencyService;
    private final TryOnGenerationClient tryOnGenerationClient;
    private final TryOnPolicy tryOnPolicy;

    /* ==================== 조회 ==================== */

    /** 실패한 Job 도 예외가 아니라 status=FAILED 로 반환한다. */
    @Transactional(readOnly = true)
    public TryOnJobDetailResponseDTO read(Long jobId, Authentication authentication) {
        TryOnJob job = requireJob(jobId);
        requireJobAccess(job, authentication);
        return toDetail(job);
    }

    /* ==================== 등록 ==================== */

    public TryOnJobCreateResponseDTO create(
            TryOnJobCreateRequestDTO request,
            String idempotencyKey,
            Authentication authentication
    ) {
        TryOnContextType contextType = parseContextType(request.context().type());

        Room room = null;
        RoomParticipant participant = null;
        User member;
        if (contextType.isRoom()) {
            room = requireOpenRoom(request.context().roomCode());
            participant = roomAuthResolver.requireParticipant(authentication, room);
            requireBoardVersion(room, request.context().boardVersion());
            // 방에서는 비회원 게스트도 착장을 만들 수 있다.
            member = roomAuthResolver.findMember(authentication).orElse(null);
        } else {
            // SOLO 는 방이 없어 소유자를 회원으로만 특정할 수 있다.
            member = roomAuthResolver.requireMember(authentication);
        }

        Avatar avatar = avatarRepository.findById(request.avatarId())
                .orElseThrow(() -> new ApiException(
                        ErrorCode.AVATAR_NOT_FOUND,
                        Map.of("avatarId", request.avatarId())
                ));

        List<ResolvedItem> items = resolveItems(contextType, room, request.items());
        WearOptionValues wearOptions = parseWearOptions(request.wearOptions());
        String requestHash = hashJobRequest(avatar.getId(), items, wearOptions, request.prompt());

        Optional<TryOnJobCreateResponseDTO> replay = findReplay(
                member,
                idempotencyKey,
                CREATE_ENDPOINT,
                requestHash,
                TryOnJobCreateResponseDTO.class
        );
        if (replay.isPresent()) {
            return replay.get();
        }

        requireQuota(member, participant);

        TryOnJob job = TryOnJob.builder()
                .contextType(contextType.name())
                .room(room)
                .boardVersion(room == null ? null : room.getVersion())
                .ownerUser(member)
                .ownerParticipant(participant)
                .avatar(avatar)
                .topTuck(wearOptions.topTuck())
                .outerClosure(wearOptions.outerClosure())
                .sleeves(wearOptions.sleeves())
                .prompt(request.prompt())
                .status(TryOnJobStatus.QUEUED.name())
                .cacheHit(false)
                .requestHash(requestHash)
                .build();

        // 동일 구성으로 이미 생성된 이미지가 있으면 재생성하지 않고 결과를 복사한다.
        reuseCachedResult(job, requestHash);

        TryOnJob saved = tryOnJobRepository.save(job);
        saveItems(saved, items);

        if (!saved.isCacheHit()) {
            tryOnGenerationClient.submit(toGenerationRequest(saved, avatar, items, wearOptions));
        }

        TryOnJobCreateResponseDTO response = new TryOnJobCreateResponseDTO(
                saved.getId(),
                saved.getStatus(),
                saved.isCacheHit(),
                tryOnPolicy.getPollAfterMs(),
                toInstant(saved.getCreatedAt())
        );

        rememberIdempotent(member, idempotencyKey, CREATE_ENDPOINT, requestHash, response);
        return response;
    }

    /* ==================== 재시도 ==================== */

    /** 재시도 가능한 실패 Job 만 허용하며, 원본은 그대로 두고 새 Job 을 만든다. */
    public TryOnJobRetryResponseDTO retry(
            Long jobId,
            String idempotencyKey,
            Authentication authentication
    ) {
        TryOnJob source = requireJob(jobId);
        RoomParticipant participant = requireJobAccess(source, authentication);
        // ROOM Job 은 게스트도 재시도할 수 있으므로 회원 여부는 선택이다.
        User member = participant == null
                ? roomAuthResolver.requireMember(authentication)
                : roomAuthResolver.findMember(authentication).orElse(null);

        if (!source.isRetryable()) {
            throw new ApiException(
                    ErrorCode.JOB_NOT_RETRYABLE,
                    Map.of(
                            "jobId", jobId,
                            "status", source.getStatus(),
                            "retryable", Boolean.TRUE.equals(source.getErrorRetryable())
                    )
            );
        }

        if (source.getRoom() != null) {
            requireRoomOpen(source.getRoom());
        }

        String retryHash = idempotencyService.hashRequest(RETRY_ENDPOINT, jobId);
        Optional<TryOnJobRetryResponseDTO> replay = findReplay(
                member,
                idempotencyKey,
                RETRY_ENDPOINT,
                retryHash,
                TryOnJobRetryResponseDTO.class
        );
        if (replay.isPresent()) {
            return replay.get();
        }

        requireQuota(member, participant);

        TryOnJob retryJob = tryOnJobRepository.save(TryOnJob.builder()
                .contextType(source.getContextType())
                .room(source.getRoom())
                .boardVersion(source.getBoardVersion())
                .ownerUser(member)
                .ownerParticipant(participant)
                .avatar(source.getAvatar())
                .topTuck(source.getTopTuck())
                .outerClosure(source.getOuterClosure())
                .sleeves(source.getSleeves())
                .prompt(source.getPrompt())
                .status(TryOnJobStatus.QUEUED.name())
                .cacheHit(false)
                .requestHash(source.getRequestHash())
                .retryOfJob(source)
                .build());

        List<ResolvedItem> items = copyItems(retryJob, jobId);
        tryOnGenerationClient.submit(
                toGenerationRequest(retryJob, retryJob.getAvatar(), items, currentWearOptions(retryJob))
        );

        TryOnJobRetryResponseDTO response = new TryOnJobRetryResponseDTO(
                retryJob.getId(),
                source.getId(),
                retryJob.getStatus(),
                retryJob.isCacheHit(),
                toInstant(retryJob.getCreatedAt())
        );

        rememberIdempotent(member, idempotencyKey, RETRY_ENDPOINT, retryHash, response);
        return response;
    }

    /* ==================== 방 확정 스냅샷 ==================== */

    /**
     * HOST 만 가능. 같은 방에서 성공한 Job 과 현재 보드 버전을 한 트랜잭션에서 검증한다.
     * 방 행을 비관적 락으로 잡아 동시 확정 요청이 서로를 덮어쓰지 않게 한다.
     */
    public OutfitSnapshotResponseDTO confirmSnapshot(
            String roomCode,
            OutfitSnapshotConfirmRequestDTO request,
            Authentication authentication
    ) {
        Room room = roomRepository.findByRoomCodeForUpdate(roomCode)
                .orElseThrow(() -> new ApiException(ErrorCode.ROOM_NOT_FOUND, Map.of("roomCode", roomCode)));
        requireRoomOpen(room);

        RoomParticipant participant = roomAuthResolver.requireParticipant(authentication, room);
        roomAuthResolver.requireHost(participant);

        requireBoardVersion(room, request.boardVersion());

        TryOnJob job = requireJob(request.jobId());
        if (job.getRoom() == null || !job.getRoom().getId().equals(room.getId())) {
            throw new ApiException(
                    ErrorCode.FORBIDDEN,
                    "다른 방의 착장 결과는 확정할 수 없습니다.",
                    Map.of("jobId", request.jobId(), "roomCode", roomCode)
            );
        }
        if (!job.isSucceeded()) {
            throw new ApiException(
                    ErrorCode.CONFLICT,
                    "성공한 착장 결과만 확정할 수 있습니다.",
                    Map.of("jobId", request.jobId(), "status", job.getStatus())
            );
        }

        room.setConfirmedTryOnJob(job);
        // @Version 증가값을 응답에 담아야 하므로 즉시 flush 한다.
        Room confirmed = roomRepository.saveAndFlush(room);

        return new OutfitSnapshotResponseDTO(
                confirmed.getRoomCode(),
                job.getId(),
                confirmed.getVersion()
        );
    }

    /* ==================== 권한 ==================== */

    private TryOnJob requireJob(Long jobId) {
        return tryOnJobRepository.findDetailById(jobId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND, Map.of("jobId", jobId)));
    }

    /**
     * Job 접근 권한 검증.
     * ROOM Job 은 해당 방의 참가자만, SOLO Job 은 소유 회원만 접근할 수 있다.
     *
     * @return ROOM Job 이면 요청자의 참가 정보, SOLO Job 이면 null
     */
    private RoomParticipant requireJobAccess(TryOnJob job, Authentication authentication) {
        if (job.resolveContextType().isRoom()) {
            Room room = job.getRoom();
            if (room == null) {
                // ROOM Job 인데 방 참조가 없으면 소유자를 판정할 수 없다.
                throw new ApiException(ErrorCode.FORBIDDEN, Map.of("jobId", job.getId()));
            }
            return roomAuthResolver.requireParticipant(authentication, room);
        }

        User member = roomAuthResolver.requireMember(authentication);
        User owner = job.getOwnerUser();
        if (owner == null || !owner.getId().equals(member.getId())) {
            throw new ApiException(ErrorCode.FORBIDDEN, Map.of("jobId", job.getId()));
        }
        return null;
    }

    /**
     * 요청자 1인당 1일 생성 한도.
     * 회원은 계정 기준으로, 비회원 게스트는 방 참가자 기준으로 집계한다.
     */
    private void requireQuota(User member, RoomParticipant participant) {
        LocalDateTime from = LocalDate.now(AppZone.KST).atStartOfDay();

        long used = member != null
                ? tryOnJobRepository.countByOwnerUserIdAndCreatedAtGreaterThanEqual(member.getId(), from)
                : tryOnJobRepository.countByOwnerParticipantIdAndCreatedAtGreaterThanEqual(
                        participant.getId(), from);

        if (used >= tryOnPolicy.getDailyLimit()) {
            throw new ApiException(
                    ErrorCode.GENERATION_QUOTA_EXCEEDED,
                    Map.of("dailyLimit", tryOnPolicy.getDailyLimit(), "used", used)
            );
        }
    }

    /* ==================== 방·보드 검증 ==================== */

    private Room requireOpenRoom(String roomCode) {
        if (!StringUtils.hasText(roomCode)) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "ROOM 컨텍스트에는 roomCode 가 필요합니다.");
        }
        Room room = roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new ApiException(ErrorCode.ROOM_NOT_FOUND, Map.of("roomCode", roomCode)));
        requireRoomOpen(room);
        return room;
    }

    private void requireRoomOpen(Room room) {
        boolean expired = room.getExpiresAt() != null
                && room.getExpiresAt().isBefore(LocalDateTime.now(AppZone.KST));
        if (room.getFinishedAt() != null || expired) {
            throw new ApiException(ErrorCode.ROOM_CLOSED, Map.of("roomCode", room.getRoomCode()));
        }
    }

    private void requireBoardVersion(Room room, Long boardVersion) {
        if (boardVersion == null) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "ROOM 컨텍스트에는 boardVersion 이 필요합니다.");
        }
        if (!boardVersion.equals(room.getVersion())) {
            throw new ApiException(
                    ErrorCode.VERSION_CONFLICT,
                    Map.of("currentVersion", room.getVersion(), "requestedVersion", boardVersion)
            );
        }
    }

    /* ==================== 요청 해석 ==================== */

    private TryOnContextType parseContextType(String type) {
        try {
            return TryOnContextType.valueOf(type);
        } catch (IllegalArgumentException exception) {
            throw new ApiException(ErrorCode.BAD_REQUEST, Map.of("context.type", type));
        }
    }

    /**
     * 착장 구성 해석.
     * ROOM 은 roomItemId 로 방 보드의 항목을, SOLO 는 productId 로 상품을 직접 지정한다.
     */
    private List<ResolvedItem> resolveItems(
            TryOnContextType contextType,
            Room room,
            List<TryOnJobCreateRequestDTO.Item> requested
    ) {
        if (requested.size() > tryOnPolicy.getMaxItems()) {
            throw new ApiException(
                    ErrorCode.BAD_REQUEST,
                    Map.of("maxItems", tryOnPolicy.getMaxItems(), "requestedItems", requested.size())
            );
        }

        List<ResolvedItem> resolved = new ArrayList<>();
        Set<CategoryCode> usedSlots = EnumSet.noneOf(CategoryCode.class);
        int position = 0;

        for (TryOnJobCreateRequestDTO.Item item : requested) {
            CategoryCode slot = CategoryCode.find(item.slot())
                    .orElseThrow(() -> new ApiException(ErrorCode.BAD_REQUEST, Map.of("slot", item.slot())));
            if (!usedSlots.add(slot)) {
                throw new ApiException(ErrorCode.BAD_REQUEST, Map.of("duplicatedSlot", slot.name()));
            }

            Product product = contextType.isRoom()
                    ? requireRoomItemProduct(room, item)
                    : requireProduct(item);
            RoomItem roomItem = contextType.isRoom() ? findRoomItem(item.roomItemId()) : null;

            resolved.add(new ResolvedItem(
                    product,
                    roomItem,
                    slot,
                    position++,
                    item.sizeName(),
                    resolveSizeProfile(product, slot, item.sizeName())
            ));
        }
        return resolved;
    }

    private Product requireRoomItemProduct(Room room, TryOnJobCreateRequestDTO.Item item) {
        RoomItem roomItem = findRoomItem(item.roomItemId());
        if (!roomItem.getRoom().getId().equals(room.getId())) {
            throw new ApiException(
                    ErrorCode.FORBIDDEN,
                    "다른 방의 후보 의상은 사용할 수 없습니다.",
                    Map.of("roomItemId", item.roomItemId())
            );
        }
        return roomItem.getProduct();
    }

    private RoomItem findRoomItem(Long roomItemId) {
        if (roomItemId == null) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "ROOM 컨텍스트의 항목에는 roomItemId 가 필요합니다.");
        }
        return roomItemRepository.findById(roomItemId)
                .orElseThrow(() -> new ApiException(
                        ErrorCode.RESOURCE_NOT_FOUND,
                        Map.of("roomItemId", roomItemId)
                ));
    }

    private Product requireProduct(TryOnJobCreateRequestDTO.Item item) {
        if (item.productId() == null) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "SOLO 컨텍스트의 항목에는 productId 가 필요합니다.");
        }
        return productRepository.findById(item.productId())
                .orElseThrow(() -> new ApiException(
                        ErrorCode.RESOURCE_NOT_FOUND,
                        Map.of("productId", item.productId())
                ));
    }

    /**
     * 사용자가 고른 사이즈의 실측 행을 찾아 생성 요청용 치수로 펼친다.
     * 상의와 하의는 실측 항목이 서로 다르므로 slot 으로 조회 대상을 가른다.
     * 치수 표가 없는 slot(아우터·신발)은 치수 없이 사이즈명만 전달한다.
     */
    private TryOnGenerationRequest.SizeProfile resolveSizeProfile(
            Product product,
            CategoryCode slot,
            String sizeName
    ) {
        if (slot == CategoryCode.TOP) {
            ProductTopSize size = productTopSizeRepository
                    .findByProductIdAndSizeName(product.getId(), sizeName)
                    .orElseThrow(() -> unknownSize(product, sizeName, availableTopSizes(product)));

            return new TryOnGenerationRequest.SizeProfile(
                    size.getSizeName(),
                    size.getTotalLength(),
                    size.getShoulderWidth(),
                    size.getChestWidth(),
                    size.getSleeveLength(),
                    null, null, null, null
            );
        }

        if (slot == CategoryCode.BOTTOM) {
            ProductBottomSize size = productBottomSizeRepository
                    .findByProductIdAndSizeName(product.getId(), sizeName)
                    .orElseThrow(() -> unknownSize(product, sizeName, availableBottomSizes(product)));

            return new TryOnGenerationRequest.SizeProfile(
                    size.getSizeName(),
                    size.getTotalLength(),
                    null, null, null,
                    size.getWaistWidth(),
                    size.getHipWidth(),
                    size.getThighWidth(),
                    size.getRise()
            );
        }

        return new TryOnGenerationRequest.SizeProfile(
                sizeName, null, null, null, null, null, null, null, null);
    }

    // 어떤 사이즈를 고를 수 있는지 알려 주어야 클라이언트가 요청을 고칠 수 있다.
    private ApiException unknownSize(Product product, String sizeName, List<String> available) {
        return new ApiException(
                ErrorCode.BAD_REQUEST,
                "선택한 사이즈의 실측 정보를 찾을 수 없습니다.",
                Map.of(
                        "productId", product.getId(),
                        "sizeName", sizeName,
                        "availableSizes", available
                )
        );
    }

    private List<String> availableTopSizes(Product product) {
        return productTopSizeRepository.findAllByProductId(product.getId()).stream()
                .map(ProductTopSize::getSizeName)
                .toList();
    }

    private List<String> availableBottomSizes(Product product) {
        return productBottomSizeRepository.findAllByProductId(product.getId()).stream()
                .map(ProductBottomSize::getSizeName)
                .toList();
    }

    private WearOptionValues parseWearOptions(TryOnJobCreateRequestDTO.WearOptions options) {
        if (options == null) {
            return new WearOptionValues(null, null, null);
        }
        return new WearOptionValues(
                parseEnumName(TopTuck.class, options.topTuck(), "wearOptions.topTuck"),
                parseEnumName(OuterClosure.class, options.outerClosure(), "wearOptions.outerClosure"),
                parseEnumName(Sleeves.class, options.sleeves(), "wearOptions.sleeves")
        );
    }

    private WearOptionValues currentWearOptions(TryOnJob job) {
        return new WearOptionValues(job.getTopTuck(), job.getOuterClosure(), job.getSleeves());
    }

    // 미지정은 null 로 두고, 값이 있으면 허용 코드인지 검증한다.
    private <E extends Enum<E>> String parseEnumName(Class<E> type, String value, String field) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return Enum.valueOf(type, value).name();
        } catch (IllegalArgumentException exception) {
            throw new ApiException(ErrorCode.BAD_REQUEST, Map.of(field, value));
        }
    }

    /* ==================== 저장 ==================== */

    private void saveItems(TryOnJob job, List<ResolvedItem> items) {
        tryOnJobItemRepository.saveAll(items.stream()
                .map(item -> TryOnJobItem.builder()
                        .tryOnJob(job)
                        .product(item.product())
                        .roomItem(item.roomItem())
                        .slot(item.slot().name())
                        .sizeName(item.sizeName())
                        .position(item.position())
                        .build())
                .toList());
    }

    // 원본 Job 의 구성을 재시도 Job 으로 복제. 사이즈도 원본과 동일하게 유지한다.
    private List<ResolvedItem> copyItems(TryOnJob retryJob, Long sourceJobId) {
        List<ResolvedItem> items = tryOnJobItemRepository.findAllByTryOnJobIdWithProduct(sourceJobId).stream()
                .map(item -> {
                    // 저장 시 CategoryCode 이름으로만 기록하므로 해석 실패는 데이터 손상이다.
                    CategoryCode slot = CategoryCode.find(item.getSlot())
                            .orElseThrow(() -> new ApiException(
                                    ErrorCode.INTERNAL_SERVER_ERROR,
                                    Map.of("tryOnJobItemId", item.getId(), "slot", item.getSlot())
                            ));
                    return new ResolvedItem(
                            item.getProduct(),
                            item.getRoomItem(),
                            slot,
                            item.getPosition(),
                            item.getSizeName(),
                            resolveSizeProfile(item.getProduct(), slot, item.getSizeName())
                    );
                })
                .toList();
        saveItems(retryJob, items);
        return items;
    }

    /**
     * 멱등 재생 조회.
     * {@code IdempotencyRecord.user_id} 가 NOT NULL 이라 비회원 게스트는 기록을 남길 수 없다.
     * 그래서 게스트 요청은 멱등 보장 없이 그대로 수행한다.
     */
    private <T> Optional<T> findReplay(
            User member,
            String idempotencyKey,
            String endpoint,
            String requestHash,
            Class<T> responseType
    ) {
        if (member == null) {
            return Optional.empty();
        }
        return idempotencyService.findReplay(
                member.getId(), idempotencyKey, endpoint, requestHash, responseType);
    }

    private void rememberIdempotent(
            User member,
            String idempotencyKey,
            String endpoint,
            String requestHash,
            Object response
    ) {
        if (member == null) {
            return;
        }
        idempotencyService.remember(
                member.getId(),
                idempotencyKey,
                endpoint,
                requestHash,
                NO_RECOMMENDATION,
                NO_RECOMMENDATION,
                response
        );
    }

    /* ==================== 캐시 ==================== */

    private void reuseCachedResult(TryOnJob job, String requestHash) {
        Optional<TryOnJob> cached = tryOnJobRepository.findLatestSucceededByRequestHash(requestHash);
        if (cached.isEmpty()) {
            return;
        }

        TryOnJob source = cached.get();
        job.setCacheHit(true);
        job.markSucceeded(
                source.getResultImageUrl(),
                source.getResultWidth(),
                source.getResultHeight(),
                source.getFitSummary(),
                source.getDisclaimer(),
                source.getModelVersion(),
                source.getPromptVersion(),
                LocalDateTime.now(AppZone.KST)
        );
    }

    private String hashJobRequest(
            Long avatarId,
            List<ResolvedItem> items,
            WearOptionValues wearOptions,
            String prompt
    ) {
        // 순서가 달라도 같은 구성이면 같은 해시가 되도록 slot 기준으로 정렬한다.
        // 같은 상품이라도 사이즈가 다르면 다른 이미지이므로 sizeName 도 키에 넣는다.
        String itemsKey = items.stream()
                .sorted(Comparator.comparing(item -> item.slot().name()))
                .map(item -> item.slot().name() + ':' + item.product().getId() + ':' + item.sizeName())
                .reduce("", (left, right) -> left + right + ',');

        return idempotencyService.hashRequest(
                avatarId,
                itemsKey,
                wearOptions.topTuck(),
                wearOptions.outerClosure(),
                wearOptions.sleeves(),
                prompt
        );
    }

    /* ==================== 외부 요청 변환 ==================== */

    private TryOnGenerationRequest toGenerationRequest(
            TryOnJob job,
            Avatar avatar,
            List<ResolvedItem> items,
            WearOptionValues wearOptions
    ) {
        return new TryOnGenerationRequest(
                job.getId(),
                toGenerationContext(job),
                toGenerationAvatar(avatar),
                items.stream()
                        .map(item -> new TryOnGenerationRequest.Item(
                                item.product().getId(),
                                item.slot().name(),
                                item.product().getImageUrl(),
                                item.product().getSource(),
                                item.product().getDescription(),
                                item.sizeProfile()
                        ))
                        .toList(),
                new TryOnGenerationRequest.WearOptions(
                        wearOptions.topTuck(),
                        wearOptions.outerClosure(),
                        wearOptions.sleeves()
                ),
                job.getPrompt()
        );
    }

    // 공개 API 는 roomCode 로 방을 식별하지만 생성 서비스 계약은 roomId 를 쓴다.
    private TryOnGenerationRequest.Context toGenerationContext(TryOnJob job) {
        Room room = job.getRoom();
        return new TryOnGenerationRequest.Context(
                job.getContextType(),
                room == null ? null : room.getId(),
                job.getBoardVersion()
        );
    }

    /** 아바타 프리셋의 구간 id 를 실제 cm/kg 범위로 풀어서 전달한다. */
    private TryOnGenerationRequest.Avatar toGenerationAvatar(Avatar avatar) {
        Optional<HeightRange> height = HeightRange.find(avatar.getHeightId());
        Optional<WeightRange> weight = WeightRange.find(avatar.getWeightId());

        return new TryOnGenerationRequest.Avatar(
                avatar.getId(),
                avatar.getImageUrl(),
                avatar.getGender(),
                avatar.getBodyType(),
                height.map(HeightRange::getMinHeight).orElse(null),
                height.map(HeightRange::getMaxHeight).orElse(null),
                weight.map(WeightRange::getMinWeight).orElse(null),
                weight.map(WeightRange::getMaxWeight).orElse(null)
        );
    }

    /* ==================== 응답 변환 ==================== */

    private TryOnJobDetailResponseDTO toDetail(TryOnJob job) {
        TryOnJobDetailResponseDTO.Result result = job.isSucceeded()
                ? new TryOnJobDetailResponseDTO.Result(
                job.getResultImageUrl(),
                job.getResultWidth(),
                job.getResultHeight(),
                job.getFitSummary(),
                job.getDisclaimer()
        )
                : null;

        TryOnJobDetailResponseDTO.Error error = job.isFailed()
                ? new TryOnJobDetailResponseDTO.Error(
                job.getErrorCode(),
                job.getErrorMessage(),
                Boolean.TRUE.equals(job.getErrorRetryable())
        )
                : null;

        return new TryOnJobDetailResponseDTO(
                job.getId(),
                job.getStatus(),
                job.isCacheHit(),
                result,
                error,
                job.getModelVersion(),
                job.getPromptVersion(),
                toInstant(job.getCreatedAt()),
                toInstant(job.getCompletedAt())
        );
    }

    private Instant toInstant(LocalDateTime value) {
        return value == null ? null : value.atZone(AppZone.KST).toInstant();
    }

    /* ==================== 내부 값 객체 ==================== */

    private record ResolvedItem(
            Product product,
            RoomItem roomItem,
            CategoryCode slot,
            int position,
            String sizeName,
            TryOnGenerationRequest.SizeProfile sizeProfile
    ) {
    }

    private record WearOptionValues(
            String topTuck,
            String outerClosure,
            String sleeves
    ) {
    }
}
