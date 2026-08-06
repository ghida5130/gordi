package com.ssafy.backend.service;

import com.ssafy.backend.common.aop.BusinessOperation;
import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Avatar;
import com.ssafy.backend.domain.Recommendation;
import com.ssafy.backend.domain.RecommendationItem;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.RoomItem;
import com.ssafy.backend.domain.RoomParticipant;
import com.ssafy.backend.domain.Tier;
import com.ssafy.backend.domain.TryOnJob;
import com.ssafy.backend.domain.User;
import com.ssafy.backend.dto.room.*;
import com.ssafy.backend.repository.RecommendationItemRepository;
import com.ssafy.backend.repository.RecommendationRepository;
import com.ssafy.backend.repository.RoomItemRepository;
import com.ssafy.backend.repository.RoomParticipantRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.repository.TierRepository;
import com.ssafy.backend.repository.TryOnJobRepository;
import com.ssafy.backend.repository.UserRepository;
import com.ssafy.backend.util.ImageUrlResolver;
import com.ssafy.backend.util.RoomTokenProvider;
import com.ssafy.backend.websocket.RoomPrincipal;
import com.ssafy.backend.websocket.event.ParticipantJoinedEvent;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class RoomService {

    private static final String WAITING = "WAITING";
    private static final String HOST = "HOST";
    private static final String PARTICIPANTS = "PARTICIPANTS";
    private static final String WEB_SOCKET_URL = "/ws/v1";
    private static final String ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int ROOM_CODE_LENGTH = 6;
    private static final int ROOM_CODE_GENERATION_ATTEMPTS = 20;
    private static final int ROOM_ITEM_POSITION_STEP = 10_000;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final List<String> DEFAULT_TIER_NAMES = List.of("S", "A", "B", "C");

    private final RoomRepository roomRepository;
    private final RoomParticipantRepository roomParticipantRepository;
    private final RoomItemRepository roomItemRepository;
    private final TierRepository tierRepository;
    private final RecommendationRepository recommendationRepository;
    private final RecommendationItemRepository recommendationItemRepository;
    private final UserRepository userRepository;
    private final TryOnJobRepository tryOnJobRepository;
    private final RoomTokenProvider roomTokenProvider;
    private final ApplicationEventPublisher eventPublisher;
    private final ImageUrlResolver imageUrlResolver;
    private final long roomExpirationMillis;

    public RoomService(
            RoomRepository roomRepository,
            RoomParticipantRepository roomParticipantRepository,
            RoomItemRepository roomItemRepository,
            TierRepository tierRepository,
            RecommendationRepository recommendationRepository,
            RecommendationItemRepository recommendationItemRepository,
            UserRepository userRepository,
            TryOnJobRepository tryOnJobRepository,
            RoomTokenProvider roomTokenProvider,
            ApplicationEventPublisher eventPublisher,
            ImageUrlResolver imageUrlResolver,
            @Value("${room.expiration:7200000}") long roomExpirationMillis
    ) {
        this.roomRepository = roomRepository;
        this.roomParticipantRepository = roomParticipantRepository;
        this.roomItemRepository = roomItemRepository;
        this.tierRepository = tierRepository;
        this.recommendationRepository = recommendationRepository;
        this.recommendationItemRepository = recommendationItemRepository;
        this.userRepository = userRepository;
        this.tryOnJobRepository = tryOnJobRepository;
        this.roomTokenProvider = roomTokenProvider;
        this.eventPublisher = eventPublisher;
        this.imageUrlResolver = imageUrlResolver;
        if (roomExpirationMillis <= 0) {
            throw new IllegalArgumentException("room.expiration은 0보다 커야 합니다.");
        }
        this.roomExpirationMillis = roomExpirationMillis;
    }

    @BusinessOperation(value = "room.create", slowThresholdMs = 1_500)
    @Transactional
    public RoomCreateResponseDTO create(
            String email,
            RoomCreateRequestDTO request,
            String rawIdempotencyKey
    ) {
        String idempotencyKey = normalizeIdempotencyKey(rawIdempotencyKey);
        User host = findUser(email);
        requireHostAvatar(host);

        Room existingRoom = roomRepository
                .findByHostUserIdAndIdempotencyKey(host.getId(), idempotencyKey)
                .orElse(null);
        if (existingRoom != null) {
            validateIdempotentRequest(existingRoom, request);
            RoomParticipant hostParticipant = roomParticipantRepository
                    .findByRoomIdAndUserId(existingRoom.getId(), host.getId())
                    .orElseThrow(() -> new ApiException(ErrorCode.INTERNAL_SERVER_ERROR));
            return createResponse(
                    existingRoom,
                    hostParticipant,
                    roomItemRepository.countByRoomId(existingRoom.getId())
            );
        }

        Recommendation recommendation = recommendationRepository
                .findByIdAndUserId(request.recommendationId(), host.getId())
                .orElseThrow(() -> new ApiException(
                        ErrorCode.RESOURCE_NOT_FOUND,
                        Map.of("resource", "recommendation")
                ));
        validateRecommendation(recommendation, request.recommendationVersion());

        List<RecommendationItem> recommendationItems = recommendationItemRepository
                .findAllByRecommendationIdAndRecommendationVersionOrderByRankAsc(
                        recommendation.getId(),
                        request.recommendationVersion()
                );

        Room room = roomRepository.save(Room.builder()
                .roomCode(generateRoomCode())
                .hostUser(host)
                .recommendation(recommendation)
                .recommendationVersion(request.recommendationVersion())
                .maxParticipants(request.maxParticipants())
                .idempotencyKey(idempotencyKey)
                .status(WAITING)
                .expiresAt(LocalDateTime.now(AppZone.KST)
                        .plus(Duration.ofMillis(roomExpirationMillis)))
                .build());

        snapshotRecommendationItems(room, recommendationItems);
        createDefaultTiers(room);

        RoomParticipant hostParticipant = roomParticipantRepository.save(RoomParticipant.builder()
                .room(room)
                .user(host)
                .nickname(host.getNickname())
                .role(HOST)
                .build());

        return createResponse(room, hostParticipant, recommendationItems.size());
    }

    @BusinessOperation(value = "room.join", slowThresholdMs = 1_500)
    @Transactional
    public RoomJoinResponseDTO join(
            String rawRoomCode,
            RoomJoinRequestDTO request,
            String email
    ) {
        String roomCode = normalizeRoomCode(rawRoomCode);
        String nickname = normalizeNickname(request.nickname());
        Room room = roomRepository.findByRoomCodeForUpdate(roomCode)
                .orElseThrow(() -> new ApiException(ErrorCode.ROOM_NOT_FOUND));
        validateJoinable(room);

        User user = email == null ? null : findUser(email);
        if (user != null) {
            RoomParticipant existingParticipant = roomParticipantRepository
                    .findByRoomIdAndUserId(room.getId(), user.getId())
                    .orElse(null);
            if (existingParticipant != null) {
                return rejoin(room, existingParticipant, nickname);
            }
        }

        ensureCapacity(room);
        RoomParticipant participant = roomParticipantRepository.save(RoomParticipant.builder()
                .room(room)
                .user(user)
                .nickname(nickname)
                .role(PARTICIPANTS)
                .build());

        publishParticipantJoined(room, participant);
        return joinResponse(room, participant);
    }

    @Transactional(readOnly = true)
    public MyActiveRoomResponseDTO readMyActiveRoom(String email) {
        return roomParticipantRepository
                .findActiveByUserEmail(email, LocalDateTime.now(AppZone.KST))
                .stream().findFirst()
                .map(rp -> new MyActiveRoomResponseDTO(new MyActiveRoomResponseDTO.ActiveRoom(
                        rp.getRoom().getId(),
                        rp.getRoom().getRoomCode(),
                        rp.getRoom().getStatus(),
                        rp.getRole(),
                        rp.getRoom().getExpiresAt().atZone(AppZone.KST).toInstant())))
                .orElseGet(() -> new MyActiveRoomResponseDTO(null));
    }

    @Transactional(readOnly = true)
    public RoomStatusResponseDTO readStatus(
            String rawRoomCode,
            RoomPrincipal principal
    ) {
        Room room = findReadableRoom(rawRoomCode);
        requireActiveParticipant(room.getId(), principal);
        return createRoomStatusResponse(room);
    }

    @Transactional(readOnly = true)
    public RoomStatusResponseDTO readStatusByAccessToken(
            String rawRoomCode,
            String email
    ) {
        Room room = findReadableRoom(rawRoomCode);
        requireActiveParticipant(room.getId(), email);
        return createRoomStatusResponse(room);
    }

    private Room findReadableRoom(String rawRoomCode) {
        String roomCode = normalizeRoomCode(rawRoomCode);
        Room room = roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new ApiException(ErrorCode.ROOM_NOT_FOUND));
        validateJoinable(room);
        return room;
    }

    private RoomStatusResponseDTO createRoomStatusResponse(Room room) {
        List<RoomStatusResponseDTO.Participant> participants = roomParticipantRepository
                .findAllByRoomIdAndLeftAtIsNullOrderByJoinedAtAsc(room.getId())
                .stream()
                .map(participant -> new RoomStatusResponseDTO.Participant(
                        participant.getId(),
                        participant.getNickname(),
                        participant.getRole()
                ))
                .toList();

        List<RoomStatusResponseDTO.Tier> tiers = tierRepository
                .findAllByRoomIdOrderByPositionAsc(room.getId())
                .stream()
                .map(tier -> new RoomStatusResponseDTO.Tier(
                        tier.getId(),
                        tier.getName(),
                        tier.getPosition()
                ))
                .toList();

        return new RoomStatusResponseDTO(
                room.getId(),
                room.getRoomCode(),
                room.getStatus(),
                room.getVersion(),
                room.getExpiresAt().atZone(AppZone.KST).toInstant(),
                room.getRecommendation().getCategory(),
                room.getRecommendation().getSubcategory(),
                resolveHostAvatarImageUrl(room),
                participants,
                tiers
        );
    }

    private String resolveHostAvatarImageUrl(Room room) {
        String latestTryOnImageUrl = tryOnJobRepository
                .findFirstByRoomIdAndResultImageUrlIsNotNullOrderByCreatedAtDesc(room.getId())
                .map(TryOnJob::getResultImageUrl)
                .filter(imageUrl -> !imageUrl.isBlank())
                .orElse(null);
        if (latestTryOnImageUrl != null) {
            return imageUrlResolver.resolve(latestTryOnImageUrl);
        }

        User host = room.getHostUser();
        Avatar avatar = host.getAvatar();
        if (avatar == null
                || avatar.getImageUrl() == null
                || avatar.getImageUrl().isBlank()) {
            throw new ApiException(
                    ErrorCode.INTERNAL_SERVER_ERROR,
                    "방 호스트의 아바타 정보가 없습니다.",
                    Map.of("roomId", room.getId())
            );
        }
        return imageUrlResolver.resolve(avatar.getImageUrl());
    }

    private void requireHostAvatar(User host) {
        Avatar avatar = host.getAvatar();
        if (avatar == null
                || avatar.getImageUrl() == null
                || avatar.getImageUrl().isBlank()) {
            throw new ApiException(
                    ErrorCode.BAD_REQUEST,
                    "방 생성 전에 아바타를 선택해야 합니다."
            );
        }
    }

    private RoomJoinResponseDTO rejoin(
            Room room,
            RoomParticipant participant,
            String nickname
    ) {
        if (participant.getLeftAt() != null) {
            ensureCapacity(room);
            participant.setLeftAt(null);
        }
        participant.setNickname(nickname);
        roomParticipantRepository.save(participant);
        publishParticipantJoined(room, participant);
        return joinResponse(room, participant);
    }

    // - 인자: 참여 대상 방과 저장된 참여자
    // - 동작: 커밋 후 브로드캐스트될 PARTICIPANT_JOINED 도메인 이벤트 발행
    private void publishParticipantJoined(Room room, RoomParticipant participant) {
        eventPublisher.publishEvent(new ParticipantJoinedEvent(
                room.getId(),
                room.getVersion(),
                participant.getId(),
                participant.getNickname(),
                participant.getRole()
        ));
    }

    private void validateRecommendation(Recommendation recommendation, Long requestedVersion) {
        if (!"READY".equals(recommendation.getStatus())) {
            throw new ApiException(
                    ErrorCode.CONFLICT,
                    "READY 상태의 추천만 방으로 만들 수 있습니다.",
                    Map.of("status", recommendation.getStatus())
            );
        }
        if (!Objects.equals(recommendation.getVersion(), requestedVersion)) {
            throw new ApiException(
                    ErrorCode.VERSION_CONFLICT,
                    Map.of("latestVersion", recommendation.getVersion())
            );
        }
    }

    private void validateIdempotentRequest(Room room, RoomCreateRequestDTO request) {
        boolean sameRequest = Objects.equals(room.getRecommendation().getId(), request.recommendationId())
                && Objects.equals(room.getRecommendationVersion(), request.recommendationVersion())
                && Objects.equals(room.getMaxParticipants(), request.maxParticipants());
        if (!sameRequest) {
            throw new ApiException(ErrorCode.IDEMPOTENCY_KEY_REUSED);
        }
    }

    private void validateJoinable(Room room) {
        boolean expired = !room.getExpiresAt().isAfter(LocalDateTime.now(AppZone.KST));
        boolean closedStatus = "FINISHED".equals(room.getStatus())
                || "EXPIRED".equals(room.getStatus());
        if (expired || closedStatus) {
            throw new ApiException(ErrorCode.ROOM_CLOSED);
        }
    }

    private void ensureCapacity(Room room) {
        long activeParticipants = roomParticipantRepository.countByRoomIdAndLeftAtIsNull(room.getId());
        if (activeParticipants >= room.getMaxParticipants()) {
            throw new ApiException(
                    ErrorCode.ROOM_FULL,
                    Map.of("maxParticipants", room.getMaxParticipants())
            );
        }
    }

    private User findUser(String email) {
        if (email == null || email.isBlank()) {
            throw new ApiException(ErrorCode.UNAUTHORIZED);
        }
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
    }

    private void requireActiveParticipant(Long roomId, RoomPrincipal principal) {
        if (principal == null) {
            throw new ApiException(ErrorCode.UNAUTHORIZED);
        }
        if (!Objects.equals(roomId, principal.roomId())) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }
        roomParticipantRepository
                .findByIdAndRoomIdAndLeftAtIsNull(principal.participantId(), roomId)
                .orElseThrow(() -> new ApiException(ErrorCode.FORBIDDEN));
    }

    private void requireActiveParticipant(Long roomId, String email) {
        if (email == null || email.isBlank()) {
            throw new ApiException(ErrorCode.UNAUTHORIZED);
        }
        roomParticipantRepository
                .findByRoomIdAndUserEmailAndLeftAtIsNull(roomId, email)
                .orElseThrow(() -> new ApiException(ErrorCode.FORBIDDEN));
    }

    private void snapshotRecommendationItems(
            Room room,
            List<RecommendationItem> recommendationItems
    ) {
        List<RoomItem> roomItems = recommendationItems.stream()
                .map(item -> RoomItem.builder()
                        .room(room)
                        .product(item.getProduct())
                        .position(item.getRank() * ROOM_ITEM_POSITION_STEP)
                        .build())
                .toList();
        roomItemRepository.saveAll(roomItems);
    }

    private void createDefaultTiers(Room room) {
        List<Tier> tiers = DEFAULT_TIER_NAMES.stream()
                .map(name -> Tier.builder()
                        .room(room)
                        .name(name)
                        .position(DEFAULT_TIER_NAMES.indexOf(name))
                        .build())
                .toList();
        tierRepository.saveAll(tiers);
    }

    private RoomCreateResponseDTO createResponse(
            Room room,
            RoomParticipant participant,
            long candidateCount
    ) {
        String roomToken = roomTokenProvider.createRoomToken(
                participant.getId(),
                room.getId(),
                participant.getNickname(),
                participant.getRole(),
                room.getExpiresAt()
        );
        return new RoomCreateResponseDTO(
                room.getId(),
                room.getRoomCode(),
                room.getStatus(),
                candidateCount,
                room.getMaxParticipants(),
                participant.getId(),
                roomToken,
                WEB_SOCKET_URL,
                room.getExpiresAt().atZone(AppZone.KST).toInstant()
        );
    }

    private RoomJoinResponseDTO joinResponse(Room room, RoomParticipant participant) {
        String roomToken = roomTokenProvider.createRoomToken(
                participant.getId(),
                room.getId(),
                participant.getNickname(),
                participant.getRole(),
                room.getExpiresAt()
        );
        return new RoomJoinResponseDTO(
                room.getId(),
                participant.getId(),
                participant.getRole(),
                roomToken,
                room.getStatus(),
                room.getVersion()
        );
    }

    private String generateRoomCode() {
        for (int attempt = 0; attempt < ROOM_CODE_GENERATION_ATTEMPTS; attempt++) {
            StringBuilder code = new StringBuilder(ROOM_CODE_LENGTH);
            for (int index = 0; index < ROOM_CODE_LENGTH; index++) {
                code.append(ROOM_CODE_ALPHABET.charAt(
                        SECURE_RANDOM.nextInt(ROOM_CODE_ALPHABET.length())
                ));
            }
            String candidate = code.toString();
            if (!roomRepository.existsByRoomCode(candidate)) {
                return candidate;
            }
        }
        throw new ApiException(ErrorCode.INTERNAL_SERVER_ERROR);
    }

    private String normalizeIdempotencyKey(String rawIdempotencyKey) {
        if (rawIdempotencyKey == null || rawIdempotencyKey.isBlank()) {
            throw new ApiException(
                    ErrorCode.BAD_REQUEST,
                    Map.of("field", "Idempotency-Key")
            );
        }
        try {
            return UUID.fromString(rawIdempotencyKey.strip()).toString();
        } catch (IllegalArgumentException exception) {
            throw new ApiException(
                    ErrorCode.BAD_REQUEST,
                    "Idempotency-Key는 UUID 형식이어야 합니다.",
                    Map.of("field", "Idempotency-Key")
            );
        }
    }

    private String normalizeRoomCode(String rawRoomCode) {
        if (rawRoomCode == null) {
            throw new ApiException(ErrorCode.ROOM_NOT_FOUND);
        }
        return rawRoomCode.strip().toUpperCase(Locale.ROOT);
    }

    private String normalizeNickname(String rawNickname) {
        if (rawNickname == null) {
            throw new ApiException(ErrorCode.INVALID_NICKNAME);
        }
        String nickname = rawNickname.strip();
        if (nickname.isEmpty() || nickname.length() > 20) {
            throw new ApiException(ErrorCode.INVALID_NICKNAME);
        }
        return nickname;
    }
}
