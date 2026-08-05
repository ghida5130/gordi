package com.ssafy.backend.service;

import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.websocket.event.RoomExpiredEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RoomExpirationServiceTest {

    private RoomRepository roomRepository;
    private ApplicationEventPublisher eventPublisher;
    private RoomExpirationService roomExpirationService;

    @BeforeEach
    void setUp() {
        roomRepository = mock(RoomRepository.class);
        eventPublisher = mock(ApplicationEventPublisher.class);
        roomExpirationService = new RoomExpirationService(roomRepository, eventPublisher);
    }

    @Test
    void dueInProgressRoomTransitionsToExpiredAndPublishesEvent() {
        Room room = room("IN_PROGRESS", LocalDateTime.now(AppZone.KST).minusSeconds(1));
        when(roomRepository.findByIdForUpdate(31L)).thenReturn(Optional.of(room));
        when(roomRepository.saveAndFlush(room)).thenAnswer(invocation -> {
            room.setVersion(8L);
            return room;
        });

        boolean expired = roomExpirationService.expire(31L);

        assertThat(expired).isTrue();
        assertThat(room.getStatus()).isEqualTo("EXPIRED");
        ArgumentCaptor<RoomExpiredEvent> eventCaptor =
                ArgumentCaptor.forClass(RoomExpiredEvent.class);
        verify(eventPublisher).publishEvent(eventCaptor.capture());
        assertThat(eventCaptor.getValue()).isEqualTo(new RoomExpiredEvent(31L, 8L));
    }

    @Test
    void futureRoomIsNotExpired() {
        Room room = room("IN_PROGRESS", LocalDateTime.now(AppZone.KST).plusMinutes(1));
        when(roomRepository.findByIdForUpdate(31L)).thenReturn(Optional.of(room));

        boolean expired = roomExpirationService.expire(31L);

        assertThat(expired).isFalse();
        assertThat(room.getStatus()).isEqualTo("IN_PROGRESS");
        verify(roomRepository, never()).saveAndFlush(room);
        verify(eventPublisher, never()).publishEvent(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void terminalRoomIsNotExpiredAgain() {
        Room room = room("EXPIRED", LocalDateTime.now(AppZone.KST).minusMinutes(1));
        when(roomRepository.findByIdForUpdate(31L)).thenReturn(Optional.of(room));

        boolean expired = roomExpirationService.expire(31L);

        assertThat(expired).isFalse();
        verify(roomRepository, never()).saveAndFlush(room);
        verify(eventPublisher, never()).publishEvent(org.mockito.ArgumentMatchers.any());
    }

    private Room room(String status, LocalDateTime expiresAt) {
        return Room.builder()
                .id(31L)
                .status(status)
                .version(7L)
                .expiresAt(expiresAt)
                .build();
    }
}
