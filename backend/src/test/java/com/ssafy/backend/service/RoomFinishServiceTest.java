package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Product;
import com.ssafy.backend.domain.Result;
import com.ssafy.backend.domain.ResultBoardItem;
import com.ssafy.backend.domain.ResultTier;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.RoomItem;
import com.ssafy.backend.domain.RoomParticipant;
import com.ssafy.backend.domain.Tier;
import com.ssafy.backend.domain.TryOnJob;
import com.ssafy.backend.domain.User;
import com.ssafy.backend.dto.room.RoomFinishRequestDTO;
import com.ssafy.backend.dto.room.RoomFinishResponseDTO;
import com.ssafy.backend.repository.ResultBoardItemRepository;
import com.ssafy.backend.repository.ResultRepository;
import com.ssafy.backend.repository.ResultTierRepository;
import com.ssafy.backend.repository.RoomItemRepository;
import com.ssafy.backend.repository.RoomParticipantRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.repository.TierRepository;
import com.ssafy.backend.repository.TryOnJobRepository;
import com.ssafy.backend.util.ImageUrlResolver;
import com.ssafy.backend.websocket.RoomPrincipal;
import com.ssafy.backend.websocket.event.RoomFinishedEvent;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoomFinishServiceTest {

    @Mock
    private RoomRepository roomRepository;
    @Mock
    private RoomParticipantRepository roomParticipantRepository;
    @Mock
    private RoomItemRepository roomItemRepository;
    @Mock
    private TierRepository tierRepository;
    @Mock
    private TryOnJobRepository tryOnJobRepository;
    @Mock
    private ResultRepository resultRepository;
    @Mock
    private ResultTierRepository resultTierRepository;
    @Mock
    private ResultBoardItemRepository resultBoardItemRepository;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    private RoomFinishService roomFinishService;

    @BeforeEach
    void setUp() {
        roomFinishService = new RoomFinishService(
                roomRepository,
                roomParticipantRepository,
                roomItemRepository,
                tierRepository,
                tryOnJobRepository,
                resultRepository,
                resultTierRepository,
                resultBoardItemRepository,
                eventPublisher,
                new ImageUrlResolver("")
        );
    }

    @Test
    void hostFinishesRoomAndStoresResultSnapshot() {
        Fixture fixture = fixture("HOST");
        stubSnapshotData(fixture);
        when(roomRepository.finishIfVersionMatches(anyLong(), anyLong(), any(LocalDateTime.class)))
                .thenReturn(1);
        when(resultRepository.save(any(Result.class))).thenAnswer(invocation -> {
            Result result = invocation.getArgument(0);
            result.setId(51L);
            return result;
        });

        RoomFinishResponseDTO response = roomFinishService.finish(
                " a7k9q2 ",
                new RoomFinishRequestDTO(17L),
                fixture.principal()
        );

        assertThat(response.resultId()).isEqualTo(51L);
        assertThat(response.roomId()).isEqualTo(31L);
        assertThat(response.status()).isEqualTo("FINISHED");
        assertThat(response.topItems())
                .extracting(RoomFinishResponseDTO.TopItem::productId)
                .containsExactly(101L, 102L);
        assertThat(response.snapshotImageUrl()).isEqualTo("https://cdn.example.com/fitting.webp");

        ArgumentCaptor<Result> resultCaptor = ArgumentCaptor.forClass(Result.class);
        verify(resultRepository).save(resultCaptor.capture());
        assertThat(resultCaptor.getValue().getBoardVersion()).isEqualTo(17L);
        assertThat(resultCaptor.getValue().getOwnerUser()).isSameAs(fixture.host());
        assertThat(resultCaptor.getValue().getTryOnJob()).isSameAs(fixture.tryOnJob());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Iterable<ResultTier>> tierCaptor = ArgumentCaptor.forClass(Iterable.class);
        verify(resultTierRepository).saveAll(tierCaptor.capture());
        assertThat(tierCaptor.getValue()).hasSize(2);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Iterable<ResultBoardItem>> boardItemCaptor =
                ArgumentCaptor.forClass(Iterable.class);
        verify(resultBoardItemRepository).saveAll(boardItemCaptor.capture());
        assertThat(boardItemCaptor.getValue())
                .hasSize(3)
                .extracting(ResultBoardItem::getProduct)
                .extracting(Product::getId)
                .containsExactly(101L, 102L, 105L);

        ArgumentCaptor<RoomFinishedEvent> eventCaptor =
                ArgumentCaptor.forClass(RoomFinishedEvent.class);
        verify(eventPublisher).publishEvent(eventCaptor.capture());
        assertThat(eventCaptor.getValue().roomId()).isEqualTo(31L);
        assertThat(eventCaptor.getValue().roomVersion()).isEqualTo(18L);
        assertThat(eventCaptor.getValue().senderParticipantId()).isEqualTo(42L);
    }

    @Test
    void nonHostCannotFinishRoom() {
        Fixture fixture = fixture("PARTICIPANTS");
        when(roomRepository.findByRoomCode("A7K9Q2")).thenReturn(Optional.of(fixture.room()));
        when(roomParticipantRepository.findByIdAndRoomIdAndLeftAtIsNull(42L, 31L))
                .thenReturn(Optional.of(fixture.participant()));

        assertThatThrownBy(() -> roomFinishService.finish(
                "A7K9Q2",
                new RoomFinishRequestDTO(17L),
                fixture.principal()
        )).isInstanceOfSatisfying(ApiException.class, exception ->
                assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN));

        verify(roomRepository, never())
                .finishIfVersionMatches(anyLong(), anyLong(), any(LocalDateTime.class));
    }

    @Test
    void staleExpectedVersionRollsBackBeforeSavingResult() {
        Fixture fixture = fixture("HOST");
        when(roomRepository.findByRoomCode("A7K9Q2")).thenReturn(Optional.of(fixture.room()));
        when(roomParticipantRepository.findByIdAndRoomIdAndLeftAtIsNull(42L, 31L))
                .thenReturn(Optional.of(fixture.participant()));
        when(roomRepository.finishIfVersionMatches(anyLong(), anyLong(), any(LocalDateTime.class)))
                .thenReturn(0);

        assertThatThrownBy(() -> roomFinishService.finish(
                "A7K9Q2",
                new RoomFinishRequestDTO(17L),
                fixture.principal()
        )).isInstanceOfSatisfying(ApiException.class, exception ->
                assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.VERSION_CONFLICT));

        verify(resultRepository, never()).save(any(Result.class));
        verify(eventPublisher, never()).publishEvent(any(RoomFinishedEvent.class));
    }

    @Test
    void 빈_보드_테스트() {
        Fixture fixture = fixture("HOST");

        when(roomRepository.findByRoomCode("A7K9Q2"))
                .thenReturn(Optional.of(fixture.room()));

        when(roomParticipantRepository
                .findByIdAndRoomIdAndLeftAtIsNull(42L, 31L))
                .thenReturn(Optional.of(fixture.participant()));

        when(roomRepository.finishIfVersionMatches(
                anyLong(),
                anyLong(),
                any(LocalDateTime.class)
        )).thenReturn(1);

        when(tierRepository.findAllByRoomIdOrderByPositionAsc(31L))
                .thenReturn(fixture.tiers());

        // 모든 상품이 미분류인 상태
        when(roomItemRepository.findAllByRoomIdWithProduct(31L))
                .thenReturn(fixture.roomItems().stream()
                        .filter(item -> item.getTier() == null)
                        .toList());
        when(tryOnJobRepository
                .findFirstByRoomIdAndResultImageUrlIsNotNullOrderByCreatedAtDesc(31L))
                .thenReturn(Optional.empty());
        when(resultRepository.save(any(Result.class))).thenAnswer(invocation -> {
            Result result = invocation.getArgument(0);
            result.setId(51L);
            return result;
        });

        RoomFinishResponseDTO response = roomFinishService.finish(
                "A7K9Q2",
                new RoomFinishRequestDTO(17L),
                fixture.principal()
        );

        assertThat(response.status()).isEqualTo("FINISHED");
        assertThat(response.resultId()).isEqualTo(51L);
        assertThat(response.topItems()).isEmpty();
        assertThat(response.snapshotImageUrl()).isNull();

        verify(tryOnJobRepository)
                .findFirstByRoomIdAndResultImageUrlIsNotNullOrderByCreatedAtDesc(
                        31L
                );

        ArgumentCaptor<Result> resultCaptor = ArgumentCaptor.forClass(Result.class);
        verify(resultRepository).save(resultCaptor.capture());
        assertThat(resultCaptor.getValue().getTryOnJob()).isNull();
        assertThat(resultCaptor.getValue().getBoardVersion()).isEqualTo(17L);
        verify(resultTierRepository).saveAll(any());
        verify(resultBoardItemRepository).saveAll(any());

        verify(eventPublisher).publishEvent(any(RoomFinishedEvent.class));
    }

    @Test
    void classifiedBoardWithoutTryOnStillStoresResult() {
        Fixture fixture = fixture("HOST");

        when(roomRepository.findByRoomCode("A7K9Q2"))
                .thenReturn(Optional.of(fixture.room()));
        when(roomParticipantRepository.findByIdAndRoomIdAndLeftAtIsNull(42L, 31L))
                .thenReturn(Optional.of(fixture.participant()));
        when(roomRepository.finishIfVersionMatches(anyLong(), anyLong(), any(LocalDateTime.class)))
                .thenReturn(1);
        when(tierRepository.findAllByRoomIdOrderByPositionAsc(31L))
                .thenReturn(fixture.tiers());
        when(roomItemRepository.findAllByRoomIdWithProduct(31L))
                .thenReturn(fixture.roomItems());
        when(tryOnJobRepository
                .findFirstByRoomIdAndResultImageUrlIsNotNullOrderByCreatedAtDesc(31L))
                .thenReturn(Optional.empty());
        when(resultRepository.save(any(Result.class))).thenAnswer(invocation -> {
            Result result = invocation.getArgument(0);
            result.setId(52L);
            return result;
        });

        RoomFinishResponseDTO response = roomFinishService.finish(
                "A7K9Q2",
                new RoomFinishRequestDTO(17L),
                fixture.principal()
        );

        assertThat(response.status()).isEqualTo("FINISHED");
        assertThat(response.resultId()).isEqualTo(52L);
        assertThat(response.topItems())
                .extracting(RoomFinishResponseDTO.TopItem::productId)
                .containsExactly(101L, 102L);
        assertThat(response.snapshotImageUrl()).isNull();

        ArgumentCaptor<Result> resultCaptor = ArgumentCaptor.forClass(Result.class);
        verify(resultRepository).save(resultCaptor.capture());
        assertThat(resultCaptor.getValue().getTryOnJob()).isNull();
        verify(resultTierRepository).saveAll(any());
        verify(resultBoardItemRepository).saveAll(any());
        verify(eventPublisher).publishEvent(any(RoomFinishedEvent.class));
    }

    private void stubSnapshotData(Fixture fixture) {
        when(roomRepository.findByRoomCode("A7K9Q2")).thenReturn(Optional.of(fixture.room()));
        when(roomParticipantRepository.findByIdAndRoomIdAndLeftAtIsNull(42L, 31L))
                .thenReturn(Optional.of(fixture.participant()));
        when(tierRepository.findAllByRoomIdOrderByPositionAsc(31L)).thenReturn(fixture.tiers());
        when(roomItemRepository.findAllByRoomIdWithProduct(31L)).thenReturn(fixture.roomItems());
        when(tryOnJobRepository
                .findFirstByRoomIdAndResultImageUrlIsNotNullOrderByCreatedAtDesc(31L))
                .thenReturn(Optional.of(fixture.tryOnJob()));
    }

    private Fixture fixture(String role) {
        User host = User.builder()
                .id(1L)
                .email("host@example.com")
                .nickname("host")
                .build();
        Room room = Room.builder()
                .id(31L)
                .roomCode("A7K9Q2")
                .hostUser(host)
                .status("IN_PROGRESS")
                .version(17L)
                .expiresAt(LocalDateTime.now(AppZone.KST).plusHours(1))
                .build();
        RoomParticipant participant = RoomParticipant.builder()
                .id(42L)
                .room(room)
                .user(host)
                .nickname("host")
                .role(role)
                .build();
        Tier tierS = Tier.builder().id(1L).room(room).name("S").position(0).build();
        Tier tierA = Tier.builder().id(2L).room(room).name("A").position(1).build();
        Product first = product(101L, "first");
        Product second = product(102L, "second");
        Product third = product(105L, "third");
        Product unclassified = product(110L, "unclassified");
        List<RoomItem> roomItems = List.of(
                roomItem(301L, room, tierS, first, 10_000),
                roomItem(302L, room, tierS, second, 20_000),
                roomItem(303L, room, tierA, third, 10_000),
                roomItem(304L, room, null, unclassified, 10_000)
        );
        TryOnJob tryOnJob = TryOnJob.builder()
                .id(71L)
                .room(room)
                .resultImageUrl("https://cdn.example.com/fitting.webp")
                .build();
        RoomPrincipal principal = new RoomPrincipal(42L, 31L, "host", role);
        return new Fixture(
                room,
                host,
                participant,
                List.of(tierS, tierA),
                roomItems,
                tryOnJob,
                principal
        );
    }

    private Product product(Long id, String name) {
        return Product.builder()
                .id(id)
                .name(name)
                .brand("brand")
                .price(10_000)
                .imageUrl("https://example.com/" + id + ".png")
                .build();
    }

    private RoomItem roomItem(
            Long id,
            Room room,
            Tier tier,
            Product product,
            Integer position
    ) {
        return RoomItem.builder()
                .id(id)
                .room(room)
                .tier(tier)
                .product(product)
                .position(position)
                .build();
    }

    private record Fixture(
            Room room,
            User host,
            RoomParticipant participant,
            List<Tier> tiers,
            List<RoomItem> roomItems,
            TryOnJob tryOnJob,
            RoomPrincipal principal
    ) {
    }
}
