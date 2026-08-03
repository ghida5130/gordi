package com.ssafy.backend.websocket.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.RoomParticipant;
import com.ssafy.backend.repository.RoomParticipantRepository;
import com.ssafy.backend.websocket.event.ParticipantLeaveReason;
import com.ssafy.backend.websocket.event.ParticipantLeftEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoomLeaveServiceTest {

    @Mock
    private RoomParticipantRepository roomParticipantRepository;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private RoomLeaveService roomLeaveService;

    private RoomParticipant activeParticipant() {
        Room room = Room.builder().id(31L).version(13L).build();
        return RoomParticipant.builder()
                .id(42L)
                .room(room)
                .nickname("친구1")
                .role("PARTICIPANTS")
                .build();
    }

    @Test
    void 명시적_퇴장은_leftAt을_갱신하고_USER_REQUEST_이벤트를_발행한다() {
        when(roomParticipantRepository.findByIdAndRoomIdAndLeftAtIsNull(42L, 31L))
                .thenReturn(Optional.of(activeParticipant()));
        when(roomParticipantRepository.markLeftIfActive(anyLong(), anyLong(), any(LocalDateTime.class)))
                .thenReturn(1);

        boolean left = roomLeaveService.leave(
                31L, 42L, "request-uuid", ParticipantLeaveReason.USER_REQUEST);

        assertThat(left).isTrue();
        ArgumentCaptor<ParticipantLeftEvent> captor = ArgumentCaptor.forClass(ParticipantLeftEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        assertThat(captor.getValue()).isEqualTo(new ParticipantLeftEvent(
                31L, 13L, 42L, "request-uuid", ParticipantLeaveReason.USER_REQUEST));
    }

    @Test
    void 연결_유실_퇴장은_clientEventId_없이_처리한다() {
        when(roomParticipantRepository.findByIdAndRoomIdAndLeftAtIsNull(42L, 31L))
                .thenReturn(Optional.of(activeParticipant()));
        when(roomParticipantRepository.markLeftIfActive(anyLong(), anyLong(), any(LocalDateTime.class)))
                .thenReturn(1);

        boolean left = roomLeaveService.leave(
                31L, 42L, null, ParticipantLeaveReason.CONNECTION_LOST);

        assertThat(left).isTrue();
        ArgumentCaptor<ParticipantLeftEvent> captor = ArgumentCaptor.forClass(ParticipantLeftEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        assertThat(captor.getValue().clientEventId()).isNull();
        assertThat(captor.getValue().reason()).isEqualTo(ParticipantLeaveReason.CONNECTION_LOST);
    }

    @Test
    void 이미_퇴장한_참가자는_멱등하게_무시한다() {
        when(roomParticipantRepository.findByIdAndRoomIdAndLeftAtIsNull(42L, 31L))
                .thenReturn(Optional.empty());

        boolean left = roomLeaveService.leave(
                31L, 42L, null, ParticipantLeaveReason.CONNECTION_LOST);

        assertThat(left).isFalse();
        verify(roomParticipantRepository, never())
                .markLeftIfActive(anyLong(), anyLong(), any(LocalDateTime.class));
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void 동시_퇴장으로_조건부_갱신이_실패하면_이벤트를_발행하지_않는다() {
        when(roomParticipantRepository.findByIdAndRoomIdAndLeftAtIsNull(42L, 31L))
                .thenReturn(Optional.of(activeParticipant()));
        when(roomParticipantRepository.markLeftIfActive(anyLong(), anyLong(), any(LocalDateTime.class)))
                .thenReturn(0);

        boolean left = roomLeaveService.leave(
                31L, 42L, "request-uuid", ParticipantLeaveReason.USER_REQUEST);

        assertThat(left).isFalse();
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void 명시적_퇴장에_clientEventId가_없으면_BAD_REQUEST를_던진다() {
        assertThatThrownBy(() -> roomLeaveService.leave(
                31L, 42L, null, ParticipantLeaveReason.USER_REQUEST))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.BAD_REQUEST);
    }
}
