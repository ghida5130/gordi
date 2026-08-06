package com.ssafy.backend.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RoomExpirationSchedulerTest {

    @Test
    void oneFailureDoesNotStopOtherRooms() {
        RoomExpirationService roomExpirationService = mock(RoomExpirationService.class);
        RoomExpirationScheduler scheduler = new RoomExpirationScheduler(roomExpirationService, 10);
        when(roomExpirationService.findDueRoomIds(10)).thenReturn(List.of(1L, 2L, 3L));
        when(roomExpirationService.expire(1L)).thenReturn(true);
        when(roomExpirationService.expire(2L)).thenThrow(new IllegalStateException("test"));
        when(roomExpirationService.expire(3L)).thenReturn(true);

        scheduler.expireDueRooms();

        verify(roomExpirationService).expire(1L);
        verify(roomExpirationService).expire(2L);
        verify(roomExpirationService).expire(3L);
    }
}
