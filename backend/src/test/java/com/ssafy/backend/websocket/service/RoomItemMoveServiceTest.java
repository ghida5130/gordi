package com.ssafy.backend.websocket.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.RoomItem;
import com.ssafy.backend.domain.Tier;
import com.ssafy.backend.repository.RoomItemRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.repository.TierRepository;
import com.ssafy.backend.websocket.dto.ItemMoveRequestDTO;
import com.ssafy.backend.websocket.dto.ItemMoveRequestDTO.ItemMoveDataDTO;
import com.ssafy.backend.websocket.dto.PlacementDTO;
import com.ssafy.backend.websocket.event.ItemMovedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoomItemMoveServiceTest {

    @Mock
    private RoomRepository roomRepository;
    @Mock
    private RoomItemRepository roomItemRepository;
    @Mock
    private TierRepository tierRepository;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private RoomItemMoveService roomItemMoveService;

    private Room room;
    private Tier tierS;

    @BeforeEach
    void setUp() {
        room = Room.builder()
                .id(31L)
                .status("IN_PROGRESS")
                .version(12L)
                .expiresAt(LocalDateTime.now(AppZone.KST).plusHours(2))
                .build();
        tierS = Tier.builder().id(1L).room(room).name("S").position(0).build();
    }

    private RoomItem item(long id, Tier tier, int position) {
        return RoomItem.builder().id(id).room(room).tier(tier).position(position).build();
    }

    private ItemMoveRequestDTO request(long roomItemId, Long targetTierId, int newIndex) {
        return new ItemMoveRequestDTO(
                "request-uuid",
                12L,
                new ItemMoveDataDTO(roomItemId, targetTierId, newIndex)
        );
    }

    private ItemMovedEvent movedEvent() {
        ArgumentCaptor<ItemMovedEvent> captor = ArgumentCaptor.forClass(ItemMovedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        return captor.getValue();
    }

    @Test
    void 중간_삽입은_이웃_position의_중간값을_부여한다() {
        RoomItem item30 = item(30L, tierS, 10_000);
        RoomItem item10 = item(10L, tierS, 20_000);
        RoomItem item20 = item(20L, null, 10_000);

        when(roomRepository.findById(31L)).thenReturn(Optional.of(room));
        when(roomRepository.bumpVersionIfMatches(31L, 12L)).thenReturn(1);
        when(roomItemRepository.findAllByRoomIdOrderByPositionAsc(31L))
                .thenReturn(List.of(item30, item20, item10));
        when(tierRepository.findById(1L)).thenReturn(Optional.of(tierS));

        roomItemMoveService.moveItem(31L, 42L, request(20L, 1L, 1));

        assertThat(item20.getTier()).isEqualTo(tierS);
        assertThat(item20.getPosition()).isEqualTo(15_000);

        ItemMovedEvent event = movedEvent();
        assertThat(event.roomId()).isEqualTo(31L);
        assertThat(event.roomVersion()).isEqualTo(13L);
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.clientEventId()).isEqualTo("request-uuid");
        assertThat(event.placements()).containsExactlyInAnyOrder(
                new PlacementDTO(30L, 1L, 10_000),
                new PlacementDTO(10L, 1L, 20_000),
                new PlacementDTO(20L, 1L, 15_000)
        );
    }

    @Test
    void 간격이_소진되면_영역_전체를_10000_간격으로_재부여한다() {
        RoomItem item30 = item(30L, tierS, 1);
        RoomItem item10 = item(10L, tierS, 2);
        RoomItem item20 = item(20L, null, 10_000);

        when(roomRepository.findById(31L)).thenReturn(Optional.of(room));
        when(roomRepository.bumpVersionIfMatches(31L, 12L)).thenReturn(1);
        when(roomItemRepository.findAllByRoomIdOrderByPositionAsc(31L))
                .thenReturn(List.of(item30, item10, item20));
        when(tierRepository.findById(1L)).thenReturn(Optional.of(tierS));

        roomItemMoveService.moveItem(31L, 42L, request(20L, 1L, 1));

        assertThat(item30.getPosition()).isEqualTo(10_000);
        assertThat(item20.getPosition()).isEqualTo(20_000);
        assertThat(item10.getPosition()).isEqualTo(30_000);
        assertThat(item20.getTier()).isEqualTo(tierS);
    }

    @Test
    void targetTierId가_null이면_미분류_영역_맨뒤로_이동한다() {
        RoomItem item30 = item(30L, tierS, 10_000);
        RoomItem item20 = item(20L, null, 10_000);

        when(roomRepository.findById(31L)).thenReturn(Optional.of(room));
        when(roomRepository.bumpVersionIfMatches(31L, 12L)).thenReturn(1);
        when(roomItemRepository.findAllByRoomIdOrderByPositionAsc(31L))
                .thenReturn(List.of(item30, item20));

        // newIndex가 영역 크기를 넘으면 맨 뒤로 보정
        roomItemMoveService.moveItem(31L, 42L, request(30L, null, 5));

        assertThat(item30.getTier()).isNull();
        assertThat(item30.getPosition()).isEqualTo(20_000);
    }

    @Test
    void baseVersion이_다르면_VERSION_CONFLICT를_던지고_이벤트를_발행하지_않는다() {
        when(roomRepository.findById(31L)).thenReturn(Optional.of(room));
        when(roomRepository.bumpVersionIfMatches(31L, 12L)).thenReturn(0);

        assertThatThrownBy(() -> roomItemMoveService.moveItem(31L, 42L, request(20L, 1L, 0)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.VERSION_CONFLICT);

        verify(eventPublisher, never()).publishEvent(any(ItemMovedEvent.class));
    }

    @Test
    void 다른_방의_티어로는_이동할_수_없다() {
        Room otherRoom = Room.builder()
                .id(99L)
                .expiresAt(LocalDateTime.now(AppZone.KST).plusHours(2))
                .build();
        Tier otherTier = Tier.builder().id(7L).room(otherRoom).name("X").position(0).build();
        RoomItem item20 = item(20L, null, 10_000);

        when(roomRepository.findById(31L)).thenReturn(Optional.of(room));
        when(roomRepository.bumpVersionIfMatches(31L, 12L)).thenReturn(1);
        when(roomItemRepository.findAllByRoomIdOrderByPositionAsc(31L))
                .thenReturn(List.of(item20));
        when(tierRepository.findById(7L)).thenReturn(Optional.of(otherTier));

        assertThatThrownBy(() -> roomItemMoveService.moveItem(31L, 42L, request(20L, 7L, 0)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);

        verify(eventPublisher, never()).publishEvent(any(ItemMovedEvent.class));
    }

    @Test
    void 종료된_방이면_ROOM_CLOSED를_던진다() {
        Room finishedRoom = Room.builder()
                .id(31L)
                .status("FINISHED")
                .expiresAt(LocalDateTime.now(AppZone.KST).plusHours(2))
                .build();
        when(roomRepository.findById(31L)).thenReturn(Optional.of(finishedRoom));

        assertThatThrownBy(() -> roomItemMoveService.moveItem(31L, 42L, request(20L, 1L, 0)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.ROOM_CLOSED);

        verify(roomRepository, never()).bumpVersionIfMatches(any(), any());
    }

    @Test
    void 필수_필드가_없으면_BAD_REQUEST를_던진다() {
        ItemMoveRequestDTO noBaseVersion = new ItemMoveRequestDTO(
                "request-uuid", null, new ItemMoveDataDTO(20L, 1L, 0)
        );

        assertThatThrownBy(() -> roomItemMoveService.moveItem(31L, 42L, noBaseVersion))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.BAD_REQUEST);
    }
}
