package com.ssafy.backend.websocket.controller;

import com.ssafy.backend.websocket.RoomPrincipal;
import com.ssafy.backend.websocket.dto.RoomLeaveRequestDTO;
import com.ssafy.backend.websocket.event.ParticipantLeaveReason;
import com.ssafy.backend.websocket.service.RoomLeaveService;
import com.ssafy.backend.websocket.service.RoomStartService;
import com.ssafy.backend.websocket.service.RoomSyncService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class RoomLifecycleControllerTest {

    @Mock
    private RoomStartService roomStartService;
    @Mock
    private RoomLeaveService roomLeaveService;
    @Mock
    private RoomSyncService roomSyncService;
    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private RoomLifecycleController roomLifecycleController;

    @Test
    void 자기_방_leave_SEND를_USER_REQUEST_퇴장으로_처리한다() {
        RoomPrincipal principal = new RoomPrincipal(42L, 31L, "친구1", "PARTICIPANTS");

        roomLifecycleController.leave(
                31L,
                new RoomLeaveRequestDTO("request-uuid"),
                principal
        );

        verify(roomLeaveService).leave(
                31L, 42L, "request-uuid", ParticipantLeaveReason.USER_REQUEST);
    }

    @Test
    void 다른_방_leave_SEND는_무시한다() {
        RoomPrincipal principal = new RoomPrincipal(42L, 31L, "친구1", "PARTICIPANTS");

        roomLifecycleController.leave(
                99L,
                new RoomLeaveRequestDTO("request-uuid"),
                principal
        );

        verify(roomLeaveService, never()).leave(any(), any(), any(), any());
    }
}
