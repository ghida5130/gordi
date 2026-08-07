package com.ssafy.backend.websocket.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.infra.RedisFittingDraftStore;
import com.ssafy.backend.repository.RoomItemRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.websocket.dto.FittingDraftSizeSelectionDTO;
import com.ssafy.backend.websocket.dto.FittingDraftSnapshotDTO;
import com.ssafy.backend.websocket.dto.FittingDraftUpdateRequestDTO;
import com.ssafy.backend.websocket.dto.FittingDraftWearOptionsDTO;
import com.ssafy.backend.websocket.event.FittingDraftUpdatedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FittingDraftServiceTest {

    @Mock
    private RoomRepository roomRepository;
    @Mock
    private RoomItemRepository roomItemRepository;
    @Mock
    private RedisFittingDraftStore fittingDraftStore;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    private FittingDraftService fittingDraftService;
    private Room room;

    @BeforeEach
    void setUp() {
        fittingDraftService = new FittingDraftService(
                roomRepository,
                roomItemRepository,
                fittingDraftStore,
                eventPublisher
        );
        room = Room.builder()
                .id(31L)
                .status("IN_PROGRESS")
                .version(17L)
                .expiresAt(LocalDateTime.now(AppZone.KST).plusHours(2))
                .build();
    }

    @Test
    void 전체_초안을_Redis에_저장하고_revision을_증가시켜_이벤트를_발행한다() {
        FittingDraftUpdateRequestDTO request = request(17L, 3L);
        when(roomRepository.findByIdForUpdate(31L)).thenReturn(Optional.of(room));
        when(roomItemRepository.existsByIdAndRoomId(301L, 31L)).thenReturn(true);
        when(roomItemRepository.existsByIdAndRoomId(305L, 31L)).thenReturn(true);
        when(fittingDraftStore.compareAndSet(eq(31L), eq(3L), any(), any(Duration.class)))
                .thenReturn(true);

        fittingDraftService.update(31L, 42L, request);

        ArgumentCaptor<FittingDraftSnapshotDTO> snapshotCaptor =
                ArgumentCaptor.forClass(FittingDraftSnapshotDTO.class);
        verify(fittingDraftStore).compareAndSet(
                eq(31L),
                eq(3L),
                snapshotCaptor.capture(),
                any(Duration.class)
        );
        FittingDraftSnapshotDTO snapshot = snapshotCaptor.getValue();
        assertThat(snapshot.draftRevision()).isEqualTo(4L);
        assertThat(snapshot.sizeSelections()).containsExactly(
                new FittingDraftSizeSelectionDTO(301L, "M"),
                new FittingDraftSizeSelectionDTO(305L, "L")
        );
        assertThat(snapshot.wearOptions())
                .isEqualTo(new FittingDraftWearOptionsDTO("UNTUCKED", null, "ROLLED"));
        assertThat(snapshot.prompt()).isEqualTo("소매를 자연스럽게 한 번만 접어주세요");

        ArgumentCaptor<FittingDraftUpdatedEvent> eventCaptor =
                ArgumentCaptor.forClass(FittingDraftUpdatedEvent.class);
        verify(eventPublisher).publishEvent(eventCaptor.capture());
        FittingDraftUpdatedEvent event = eventCaptor.getValue();
        assertThat(event.roomId()).isEqualTo(31L);
        assertThat(event.roomVersion()).isEqualTo(17L);
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.clientEventId()).isEqualTo("request-uuid");
        assertThat(event.draft()).isEqualTo(snapshot);
    }

    @Test
    void baseDraftRevision이_다르면_VERSION_CONFLICT를_던지고_이벤트를_발행하지_않는다() {
        when(roomRepository.findByIdForUpdate(31L)).thenReturn(Optional.of(room));
        when(roomItemRepository.existsByIdAndRoomId(301L, 31L)).thenReturn(true);
        when(roomItemRepository.existsByIdAndRoomId(305L, 31L)).thenReturn(true);
        when(fittingDraftStore.compareAndSet(eq(31L), eq(3L), any(), any(Duration.class)))
                .thenReturn(false);

        assertThatThrownBy(() -> fittingDraftService.update(31L, 42L, request(17L, 3L)))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.VERSION_CONFLICT);

        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void baseVersion이_다르면_Redis를_갱신하지_않는다() {
        room.setVersion(18L);
        when(roomRepository.findByIdForUpdate(31L)).thenReturn(Optional.of(room));

        assertThatThrownBy(() -> fittingDraftService.update(31L, 42L, request(17L, 3L)))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.VERSION_CONFLICT);

        verify(fittingDraftStore, never()).compareAndSet(anyLong(), anyLong(), any(), any());
    }

    @Test
    void Redis_장애는_DEPENDENCY_UNAVAILABLE로_변환한다() {
        when(roomRepository.findByIdForUpdate(31L)).thenReturn(Optional.of(room));
        when(roomItemRepository.existsByIdAndRoomId(301L, 31L)).thenReturn(true);
        when(roomItemRepository.existsByIdAndRoomId(305L, 31L)).thenReturn(true);
        when(fittingDraftStore.compareAndSet(eq(31L), eq(3L), any(), any(Duration.class)))
                .thenThrow(new IllegalStateException("redis down"));

        assertThatThrownBy(() -> fittingDraftService.update(31L, 42L, request(17L, 3L)))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.DEPENDENCY_UNAVAILABLE);

        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void 잘못된_착용_옵션은_BAD_REQUEST를_던진다() {
        FittingDraftUpdateRequestDTO invalid = new FittingDraftUpdateRequestDTO(
                "request-uuid",
                17L,
                0L,
                new FittingDraftUpdateRequestDTO.Data(
                        List.of(),
                        new FittingDraftWearOptionsDTO("FULL_TUCK", null, null),
                        null
                )
        );

        assertThatThrownBy(() -> fittingDraftService.update(31L, 42L, invalid))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.BAD_REQUEST);

        verify(roomRepository, never()).findByIdForUpdate(anyLong());
    }

    private FittingDraftUpdateRequestDTO request(long baseVersion, long baseDraftRevision) {
        return new FittingDraftUpdateRequestDTO(
                "request-uuid",
                baseVersion,
                baseDraftRevision,
                new FittingDraftUpdateRequestDTO.Data(
                        List.of(
                                new FittingDraftSizeSelectionDTO(301L, "M"),
                                new FittingDraftSizeSelectionDTO(305L, "L")
                        ),
                        new FittingDraftWearOptionsDTO("UNTUCKED", null, "ROLLED"),
                        "소매를 자연스럽게 한 번만 접어주세요"
                )
        );
    }
}
