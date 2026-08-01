package com.ssafy.backend.websocket.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.websocket.dto.RoomStartRequestDTO;
import com.ssafy.backend.websocket.event.RoomStartedEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoomStartServiceTest {

    @Mock
    private RoomRepository roomRepository;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private RoomStartService roomStartService;

    private Room waitingRoom(String status) {
        return Room.builder()
                .id(31L)
                .status(status)
                .version(12L)
                .expiresAt(LocalDateTime.now(AppZone.KST).plusHours(2))
                .build();
    }

    private RoomStartRequestDTO request() {
        return new RoomStartRequestDTO("request-uuid", 12L, Map.of());
    }

    @Test
    void HOST가_시작하면_상태전이_후_ROOM_STARTED_이벤트를_발행한다() {
        when(roomRepository.findById(31L)).thenReturn(Optional.of(waitingRoom("WAITING")));
        when(roomRepository.updateStatusIfVersionMatches(31L, 12L, "IN_PROGRESS")).thenReturn(1);

        roomStartService.start(31L, 42L, "HOST", request());

        ArgumentCaptor<RoomStartedEvent> captor = ArgumentCaptor.forClass(RoomStartedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());

        RoomStartedEvent event = captor.getValue();
        assertThat(event.roomId()).isEqualTo(31L);
        assertThat(event.roomVersion()).isEqualTo(13L);
        assertThat(event.senderParticipantId()).isEqualTo(42L);
        assertThat(event.clientEventId()).isEqualTo("request-uuid");
    }

    @Test
    void HOST가_아니면_FORBIDDEN을_던진다() {
        assertThatThrownBy(() -> roomStartService.start(31L, 42L, "PARTICIPANTS", request()))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.FORBIDDEN);

        verify(roomRepository, never()).updateStatusIfVersionMatches(anyLong(), anyLong(), anyString());
        verify(eventPublisher, never()).publishEvent(any(RoomStartedEvent.class));
    }

    @Test
    void 이미_시작된_방이면_CONFLICT를_던진다() {
        when(roomRepository.findById(31L)).thenReturn(Optional.of(waitingRoom("IN_PROGRESS")));

        assertThatThrownBy(() -> roomStartService.start(31L, 42L, "HOST", request()))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.CONFLICT);
    }

    @Test
    void 종료된_방이면_ROOM_CLOSED를_던진다() {
        when(roomRepository.findById(31L)).thenReturn(Optional.of(waitingRoom("FINISHED")));

        assertThatThrownBy(() -> roomStartService.start(31L, 42L, "HOST", request()))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.ROOM_CLOSED);
    }

    @Test
    void baseVersion이_다르면_VERSION_CONFLICT를_던지고_이벤트를_발행하지_않는다() {
        when(roomRepository.findById(31L)).thenReturn(Optional.of(waitingRoom("WAITING")));
        when(roomRepository.updateStatusIfVersionMatches(31L, 12L, "IN_PROGRESS")).thenReturn(0);

        assertThatThrownBy(() -> roomStartService.start(31L, 42L, "HOST", request()))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.VERSION_CONFLICT);

        verify(eventPublisher, never()).publishEvent(any(RoomStartedEvent.class));
    }

    @Test
    void baseVersion이_없으면_BAD_REQUEST를_던진다() {
        RoomStartRequestDTO noBaseVersion = new RoomStartRequestDTO("request-uuid", null, Map.of());

        assertThatThrownBy(() -> roomStartService.start(31L, 42L, "HOST", noBaseVersion))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.BAD_REQUEST);
    }
}
