package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Product;
import com.ssafy.backend.domain.Recommendation;
import com.ssafy.backend.domain.RecommendationItem;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.RoomItem;
import com.ssafy.backend.domain.RoomParticipant;
import com.ssafy.backend.domain.User;
import com.ssafy.backend.dto.room.RoomCreateRequestDTO;
import com.ssafy.backend.dto.room.RoomCreateResponseDTO;
import com.ssafy.backend.dto.room.RoomJoinRequestDTO;
import com.ssafy.backend.dto.room.RoomJoinResponseDTO;
import com.ssafy.backend.repository.RecommendationItemRepository;
import com.ssafy.backend.repository.RecommendationRepository;
import com.ssafy.backend.repository.RoomItemRepository;
import com.ssafy.backend.repository.RoomParticipantRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.repository.TierRepository;
import com.ssafy.backend.repository.UserRepository;
import com.ssafy.backend.util.RoomTokenProvider;
import com.ssafy.backend.websocket.event.ParticipantJoinedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoomServiceTest {

    @Mock
    private RoomRepository roomRepository;
    @Mock
    private RoomParticipantRepository roomParticipantRepository;
    @Mock
    private RoomItemRepository roomItemRepository;
    @Mock
    private TierRepository tierRepository;
    @Mock
    private RecommendationRepository recommendationRepository;
    @Mock
    private RecommendationItemRepository recommendationItemRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private RoomTokenProvider roomTokenProvider;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    private RoomService roomService;

    @BeforeEach
    void setUp() {
        roomService = new RoomService(
                roomRepository,
                roomParticipantRepository,
                roomItemRepository,
                tierRepository,
                recommendationRepository,
                recommendationItemRepository,
                userRepository,
                roomTokenProvider,
                eventPublisher,
                7_200_000L
        );
    }

    @Test
    void 방_생성_성공_테스트() {
        User host = user(1L, "host@example.com", "방장");
        Recommendation recommendation = Recommendation.builder()
                .id(21L)
                .user(host)
                .category("TOP")
                .status("READY")
                .version(2L)
                .build();
        Product firstProduct = product(101L, "첫 번째");
        Product secondProduct = product(102L, "두 번째");
        List<RecommendationItem> items = List.of(
                recommendationItem(1L, recommendation, firstProduct, 1),
                recommendationItem(2L, recommendation, secondProduct, 2)
        );
        String idempotencyKey = UUID.randomUUID().toString();

        when(userRepository.findByEmail(host.getEmail())).thenReturn(Optional.of(host));
        when(roomRepository.findByHostUserIdAndIdempotencyKey(host.getId(), idempotencyKey))
                .thenReturn(Optional.empty());
        when(recommendationRepository.findByIdAndUserId(21L, host.getId()))
                .thenReturn(Optional.of(recommendation));
        when(recommendationItemRepository
                .findAllByRecommendationIdAndRecommendationVersionOrderByRankAsc(21L, 2L))
                .thenReturn(items);
        when(roomRepository.existsByRoomCode(any())).thenReturn(false);
        when(roomRepository.save(any(Room.class))).thenAnswer(invocation -> {
            Room room = invocation.getArgument(0);
            room.setId(31L);
            return room;
        });
        when(roomParticipantRepository.save(any(RoomParticipant.class))).thenAnswer(invocation -> {
            RoomParticipant participant = invocation.getArgument(0);
            participant.setId(41L);
            return participant;
        });
        when(roomTokenProvider.createRoomToken(
                eq(41L),
                eq(31L),
                eq("방장"),
                eq("HOST"),
                any(LocalDateTime.class)
        )).thenReturn("room-token");

        RoomCreateResponseDTO response = roomService.create(
                host.getEmail(),
                new RoomCreateRequestDTO(21L, 2L, 4),
                idempotencyKey
        );

        assertThat(response.roomId()).isEqualTo(31L);
        assertThat(response.roomCode()).hasSize(6);
        assertThat(response.status()).isEqualTo("WAITING");
        assertThat(response.candidateCount()).isEqualTo(2);
        assertThat(response.maxParticipants()).isEqualTo(4);
        assertThat(response.participantId()).isEqualTo(41L);
        assertThat(response.roomToken()).isEqualTo("room-token");
        assertThat(response.webSocketUrl()).isEqualTo("/ws/v1");
        assertThat(response.expiresAt()).isAfter(java.time.Instant.now());

        ArgumentCaptor<Room> roomCaptor = ArgumentCaptor.forClass(Room.class);
        verify(roomRepository).save(roomCaptor.capture());
        assertThat(roomCaptor.getValue().getRecommendationVersion()).isEqualTo(2L);
        assertThat(roomCaptor.getValue().getIdempotencyKey()).isEqualTo(idempotencyKey);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Iterable<RoomItem>> roomItemsCaptor = ArgumentCaptor.forClass(Iterable.class);
        verify(roomItemRepository).saveAll(roomItemsCaptor.capture());
        assertThat(roomItemsCaptor.getValue())
                .extracting(RoomItem::getProduct)
                .containsExactly(firstProduct, secondProduct);
        verify(tierRepository).saveAll(any());
    }

    @Test
    void 오래된_추천_버전_거부_테스트() {
        User host = user(1L, "host@example.com", "방장");
        Recommendation recommendation = Recommendation.builder()
                .id(21L)
                .user(host)
                .category("TOP")
                .status("READY")
                .version(3L)
                .build();
        String idempotencyKey = UUID.randomUUID().toString();

        when(userRepository.findByEmail(host.getEmail())).thenReturn(Optional.of(host));
        when(roomRepository.findByHostUserIdAndIdempotencyKey(host.getId(), idempotencyKey))
                .thenReturn(Optional.empty());
        when(recommendationRepository.findByIdAndUserId(21L, host.getId()))
                .thenReturn(Optional.of(recommendation));

        assertThatThrownBy(() -> roomService.create(
                host.getEmail(),
                new RoomCreateRequestDTO(21L, 2L, 4),
                idempotencyKey
        ))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.VERSION_CONFLICT);
                    assertThat(exception.getDetails()).containsEntry("latestVersion", 3L);
                });

        verify(roomRepository, never()).save(any(Room.class));
    }

    @Test
    void 방_생성_멱등성_테스트() {
        User host = user(1L, "host@example.com", "방장");
        Room room = waitingRoom(31L, 4);
        room.setHostUser(host);
        RoomParticipant hostParticipant = RoomParticipant.builder()
                .id(41L)
                .room(room)
                .user(host)
                .nickname("방장")
                .role("HOST")
                .build();

        when(userRepository.findByEmail(host.getEmail())).thenReturn(Optional.of(host));
        when(roomRepository.findByHostUserIdAndIdempotencyKey(
                host.getId(),
                room.getIdempotencyKey()
        )).thenReturn(Optional.of(room));
        when(roomParticipantRepository.findByRoomIdAndUserId(room.getId(), host.getId()))
                .thenReturn(Optional.of(hostParticipant));
        when(roomItemRepository.countByRoomId(room.getId())).thenReturn(12L);
        when(roomTokenProvider.createRoomToken(
                eq(41L),
                eq(31L),
                eq("방장"),
                eq("HOST"),
                any(LocalDateTime.class)
        )).thenReturn("reissued-host-token");

        RoomCreateResponseDTO response = roomService.create(
                host.getEmail(),
                new RoomCreateRequestDTO(21L, 2L, 4),
                room.getIdempotencyKey()
        );

        assertThat(response.roomId()).isEqualTo(31L);
        assertThat(response.candidateCount()).isEqualTo(12L);
        assertThat(response.roomToken()).isEqualTo("reissued-host-token");
        verify(roomRepository, never()).save(any(Room.class));
        verify(recommendationRepository, never()).findByIdAndUserId(anyLong(), anyLong());
    }

    @Test
    void 회원_재입장_테스트() {
        User member = user(2L, "member@example.com", "회원");
        Room room = waitingRoom(31L, 4);
        RoomParticipant participant = RoomParticipant.builder()
                .id(42L)
                .room(room)
                .user(member)
                .nickname("이전 닉네임")
                .role("PARTICIPANTS")
                .build();

        when(roomRepository.findByRoomCodeForUpdate("A7K9Q2")).thenReturn(Optional.of(room));
        when(userRepository.findByEmail(member.getEmail())).thenReturn(Optional.of(member));
        when(roomParticipantRepository.findByRoomIdAndUserId(room.getId(), member.getId()))
                .thenReturn(Optional.of(participant));
        when(roomParticipantRepository.save(participant)).thenReturn(participant);
        when(roomTokenProvider.createRoomToken(
                eq(42L),
                eq(31L),
                eq("새 닉네임"),
                eq("PARTICIPANTS"),
                any(LocalDateTime.class)
        )).thenReturn("reissued-token");

        RoomJoinResponseDTO response = roomService.join(
                "a7k9q2",
                new RoomJoinRequestDTO(" 새 닉네임 "),
                member.getEmail()
        );

        assertThat(response.participantId()).isEqualTo(42L);
        assertThat(response.roomToken()).isEqualTo("reissued-token");
        assertThat(participant.getNickname()).isEqualTo("새 닉네임");
        verify(roomParticipantRepository, never()).countByRoomIdAndLeftAtIsNull(anyLong());
    }

    @Test
    void 정원_초과_게스트_거부_테스트() {
        Room room = waitingRoom(31L, 2);
        when(roomRepository.findByRoomCodeForUpdate("A7K9Q2")).thenReturn(Optional.of(room));
        when(roomParticipantRepository.countByRoomIdAndLeftAtIsNull(room.getId()))
                .thenReturn(2L);

        assertThatThrownBy(() -> roomService.join(
                "A7K9Q2",
                new RoomJoinRequestDTO("게스트"),
                null
        ))
                .isInstanceOfSatisfying(ApiException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ROOM_FULL));

        verify(roomParticipantRepository, never()).save(any(RoomParticipant.class));
    }

    @Test
    void 게스트_신규_입장_성공_테스트() {
        Room room = waitingRoom(31L, 4);
        when(roomRepository.findByRoomCodeForUpdate("A7K9Q2")).thenReturn(Optional.of(room));
        when(roomParticipantRepository.countByRoomIdAndLeftAtIsNull(room.getId()))
                .thenReturn(1L);
        when(roomParticipantRepository.save(any(RoomParticipant.class))).thenAnswer(invocation -> {
            RoomParticipant participant = invocation.getArgument(0);
            participant.setId(42L);
            return participant;
        });
        when(roomTokenProvider.createRoomToken(
                eq(42L),
                eq(31L),
                eq("친구1"),
                eq("PARTICIPANTS"),
                any(LocalDateTime.class)
        )).thenReturn("guest-room-token");

        RoomJoinResponseDTO response = roomService.join(
                "A7K9Q2",
                new RoomJoinRequestDTO("친구1"),
                null
        );

        assertThat(response.roomId()).isEqualTo(31L);
        assertThat(response.participantId()).isEqualTo(42L);
        assertThat(response.role()).isEqualTo("PARTICIPANTS");
        assertThat(response.roomToken()).isEqualTo("guest-room-token");

        ArgumentCaptor<RoomParticipant> participantCaptor =
                ArgumentCaptor.forClass(RoomParticipant.class);
        verify(roomParticipantRepository).save(participantCaptor.capture());
        assertThat(participantCaptor.getValue().getUser()).isNull();

        ArgumentCaptor<ParticipantJoinedEvent> eventCaptor =
                ArgumentCaptor.forClass(ParticipantJoinedEvent.class);
        verify(eventPublisher).publishEvent(eventCaptor.capture());
        ParticipantJoinedEvent event = eventCaptor.getValue();
        assertThat(event.roomId()).isEqualTo(31L);
        assertThat(event.participantId()).isEqualTo(42L);
        assertThat(event.nickname()).isEqualTo("친구1");
        assertThat(event.role()).isEqualTo("PARTICIPANTS");
    }

    @Test
    void 정원_초과로_참여_실패시_이벤트를_발행하지_않는다() {
        Room room = waitingRoom(31L, 2);
        when(roomRepository.findByRoomCodeForUpdate("A7K9Q2")).thenReturn(Optional.of(room));
        when(roomParticipantRepository.countByRoomIdAndLeftAtIsNull(room.getId()))
                .thenReturn(2L);

        assertThatThrownBy(() -> roomService.join(
                "A7K9Q2",
                new RoomJoinRequestDTO("게스트"),
                null
        )).isInstanceOf(ApiException.class);

        verify(eventPublisher, never()).publishEvent(any(ParticipantJoinedEvent.class));
    }

    @Test
    void 만료_방_거부_테스트() {
        Room room = waitingRoom(31L, 4);
        room.setExpiresAt(LocalDateTime.now(AppZone.KST).minusSeconds(1));
        when(roomRepository.findByRoomCodeForUpdate("A7K9Q2")).thenReturn(Optional.of(room));

        assertThatThrownBy(() -> roomService.join(
                "A7K9Q2",
                new RoomJoinRequestDTO("게스트"),
                null
        ))
                .isInstanceOfSatisfying(ApiException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ROOM_CLOSED));
    }

    private User user(Long id, String email, String nickname) {
        return User.builder()
                .id(id)
                .email(email)
                .password("encoded-password")
                .nickname(nickname)
                .build();
    }

    private Product product(Long id, String name) {
        return Product.builder()
                .id(id)
                .name(name)
                .brand("브랜드")
                .price(10_000)
                .category("TOP")
                .subcategory("SHIRT")
                .imageUrl("https://example.com/image.png")
                .purchaseUrl("https://example.com/product")
                .build();
    }

    private RecommendationItem recommendationItem(
            Long id,
            Recommendation recommendation,
            Product product,
            int rank
    ) {
        return RecommendationItem.builder()
                .id(id)
                .recommendation(recommendation)
                .product(product)
                .recommendationVersion(recommendation.getVersion())
                .rank(rank)
                .build();
    }

    private Room waitingRoom(Long id, int maxParticipants) {
        User host = user(1L, "host@example.com", "방장");
        Recommendation recommendation = Recommendation.builder()
                .id(21L)
                .user(host)
                .category("TOP")
                .status("READY")
                .version(2L)
                .build();
        return Room.builder()
                .id(id)
                .roomCode("A7K9Q2")
                .hostUser(host)
                .recommendation(recommendation)
                .recommendationVersion(2L)
                .maxParticipants(maxParticipants)
                .idempotencyKey(UUID.randomUUID().toString())
                .status("WAITING")
                .version(0L)
                .expiresAt(LocalDateTime.now(AppZone.KST).plusHours(1))
                .build();
    }
}
