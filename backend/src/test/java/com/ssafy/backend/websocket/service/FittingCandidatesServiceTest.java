package com.ssafy.backend.websocket.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.RoomItem;
import com.ssafy.backend.repository.RoomItemRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.websocket.dto.FittingCandidateDTO;
import com.ssafy.backend.websocket.dto.FittingCandidatesUpdateRequestDTO;
import com.ssafy.backend.websocket.dto.FittingCandidatesUpdateRequestDTO.FittingCandidatesUpdateDataDTO;
import com.ssafy.backend.websocket.event.FittingCandidatesUpdatedEvent;
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
class FittingCandidatesServiceTest {

    @Mock
    private RoomRepository roomRepository;
    @Mock
    private RoomItemRepository roomItemRepository;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private FittingCandidatesService fittingCandidatesService;

    private Room room;

    @BeforeEach
    void setUp() {
        room = Room.builder()
                .id(31L)
                .status("IN_PROGRESS")
                .version(17L)
                .expiresAt(LocalDateTime.now(AppZone.KST).plusHours(2))
                .build();
    }

    private FittingCandidatesUpdateRequestDTO request(long roomItemId, Boolean selected) {
        return new FittingCandidatesUpdateRequestDTO(
                "request-uuid",
                17L,
                new FittingCandidatesUpdateDataDTO(roomItemId, selected)
        );
    }

    @Test
    void 선택_후_전체_피팅_후보를_이벤트로_발행한다() {
        RoomItem item301 = RoomItem.builder().id(301L).room(room).position(10_000).build();
        RoomItem item305 = RoomItem.builder()
                .id(305L)
                .room(room)
                .position(20_000)
                .fittingCandidate(true)
                .build();

        when(roomRepository.findByIdForUpdate(31L)).thenReturn(Optional.of(room));
        when(roomItemRepository.findByIdAndRoomId(301L, 31L)).thenReturn(Optional.of(item301));
        when(roomItemRepository.findAllByRoomIdAndFittingCandidateTrueOrderByPositionAsc(31L))
                .thenReturn(List.of(item301, item305));

        fittingCandidatesService.update(31L, 42L, request(301L, true));

        assertThat(item301.isFittingCandidate()).isTrue();

        ArgumentCaptor<FittingCandidatesUpdatedEvent> captor =
                ArgumentCaptor.forClass(FittingCandidatesUpdatedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());

        FittingCandidatesUpdatedEvent event = captor.getValue();
        assertThat(event.roomId()).isEqualTo(31L);
        assertThat(event.roomVersion()).isEqualTo(17L);
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.clientEventId()).isEqualTo("request-uuid");
        assertThat(event.fittingCandidates()).containsExactly(
                new FittingCandidateDTO(301L),
                new FittingCandidateDTO(305L)
        );
        verify(roomRepository, never()).bumpVersionIfMatches(any(), any());
    }

    @Test
    void 마지막_후보를_해제하면_빈_배열을_발행한다() {
        RoomItem item301 = RoomItem.builder()
                .id(301L)
                .room(room)
                .position(10_000)
                .fittingCandidate(true)
                .build();

        when(roomRepository.findByIdForUpdate(31L)).thenReturn(Optional.of(room));
        when(roomItemRepository.findByIdAndRoomId(301L, 31L)).thenReturn(Optional.of(item301));
        when(roomItemRepository.findAllByRoomIdAndFittingCandidateTrueOrderByPositionAsc(31L))
                .thenReturn(List.of());

        fittingCandidatesService.update(31L, 42L, request(301L, false));

        assertThat(item301.isFittingCandidate()).isFalse();

        ArgumentCaptor<FittingCandidatesUpdatedEvent> captor =
                ArgumentCaptor.forClass(FittingCandidatesUpdatedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        assertThat(captor.getValue().fittingCandidates()).isEmpty();
    }

    @Test
    void baseVersion이_다르면_VERSION_CONFLICT를_던진다() {
        room.setVersion(18L);
        when(roomRepository.findByIdForUpdate(31L)).thenReturn(Optional.of(room));

        assertThatThrownBy(() -> fittingCandidatesService.update(31L, 42L, request(301L, true)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.VERSION_CONFLICT);

        verify(roomItemRepository, never()).findByIdAndRoomId(any(), any());
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void 다른_방의_roomItem은_선택할_수_없다() {
        when(roomRepository.findByIdForUpdate(31L)).thenReturn(Optional.of(room));
        when(roomItemRepository.findByIdAndRoomId(301L, 31L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> fittingCandidatesService.update(31L, 42L, request(301L, true)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);

        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void selected가_없으면_BAD_REQUEST를_던진다() {
        assertThatThrownBy(() -> fittingCandidatesService.update(31L, 42L, request(301L, null)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.BAD_REQUEST);

        verify(roomRepository, never()).findByIdForUpdate(any());
    }
}
