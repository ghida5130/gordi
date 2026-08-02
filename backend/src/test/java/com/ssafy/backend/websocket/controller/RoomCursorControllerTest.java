package com.ssafy.backend.websocket.controller;

import com.ssafy.backend.websocket.RoomPrincipal;
import com.ssafy.backend.websocket.dto.CursorMoveRequestDTO;
import com.ssafy.backend.websocket.dto.CursorPositionDTO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class RoomCursorControllerTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private RoomCursorController roomCursorController;

    private RoomPrincipal principalOfRoom(long roomId) {
        return new RoomPrincipal(42L, roomId, "친구1", "PARTICIPANTS");
    }

    @Test
    void 커서_좌표를_participantId와_함께_방_커서_토픽으로_브로드캐스트한다() {
        roomCursorController.moveCursor(
                31L,
                new CursorMoveRequestDTO(0.42, 0.31),
                principalOfRoom(31L)
        );

        verify(messagingTemplate).convertAndSend(
                eq("/topic/v1/rooms/31/cursors"),
                eq(new CursorPositionDTO(42L, 0.42, 0.31))
        );
    }

    @Test
    void 좌표가_범위를_벗어나면_0과_1_사이로_클램프한다() {
        roomCursorController.moveCursor(
                31L,
                new CursorMoveRequestDTO(-0.5, 1.7),
                principalOfRoom(31L)
        );

        verify(messagingTemplate).convertAndSend(
                eq("/topic/v1/rooms/31/cursors"),
                eq(new CursorPositionDTO(42L, 0.0, 1.0))
        );
    }

    @Test
    void 다른_방_커서_요청은_무시한다() {
        roomCursorController.moveCursor(
                99L,
                new CursorMoveRequestDTO(0.5, 0.5),
                principalOfRoom(31L)
        );

        verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));
    }

    @Test
    void 좌표가_없거나_유한하지_않으면_무시한다() {
        roomCursorController.moveCursor(31L, new CursorMoveRequestDTO(null, 0.5), principalOfRoom(31L));
        roomCursorController.moveCursor(31L, new CursorMoveRequestDTO(Double.NaN, 0.5), principalOfRoom(31L));
        roomCursorController.moveCursor(31L, null, principalOfRoom(31L));

        verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));
    }
}
