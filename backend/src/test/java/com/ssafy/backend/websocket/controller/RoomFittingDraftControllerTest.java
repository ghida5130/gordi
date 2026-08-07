package com.ssafy.backend.websocket.controller;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.websocket.RoomPrincipal;
import com.ssafy.backend.websocket.dto.FittingDraftUpdateRequestDTO;
import com.ssafy.backend.websocket.dto.FittingDraftWearOptionsDTO;
import com.ssafy.backend.websocket.dto.RoomEventDTO;
import com.ssafy.backend.websocket.event.RoomEventType;
import com.ssafy.backend.websocket.service.FittingDraftService;
import com.ssafy.backend.websocket.service.RoomSyncService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoomFittingDraftControllerTest {

    @Mock
    private FittingDraftService fittingDraftService;
    @Mock
    private RoomSyncService roomSyncService;
    @Mock
    private SimpMessagingTemplate messagingTemplate;
    @InjectMocks
    private RoomFittingDraftController controller;

    @Test
    void 자기_방의_피팅_초안_변경을_서비스에_전달한다() {
        FittingDraftUpdateRequestDTO request = request();

        controller.update(31L, request, principal());

        verify(fittingDraftService).update(31L, 42L, request);
    }

    @Test
    void revision_충돌이면_Redis_초안이_포함된_최신_스냅샷을_보낸다() {
        FittingDraftUpdateRequestDTO request = request();
        RoomEventDTO snapshot = RoomEventDTO.of(
                RoomEventType.BOARD_SNAPSHOT,
                "request-uuid",
                31L,
                17L,
                42L,
                Map.of()
        );
        doThrow(new ApiException(ErrorCode.VERSION_CONFLICT))
                .when(fittingDraftService).update(31L, 42L, request);
        when(roomSyncService.buildSnapshot(31L, "request-uuid", 42L)).thenReturn(snapshot);

        controller.update(31L, request, principal());

        verify(messagingTemplate).convertAndSendToUser("42", "/queue/sync", snapshot);
    }

    @Test
    void 다른_방의_요청은_무시한다() {
        controller.update(99L, request(), principal());

        verify(fittingDraftService, never()).update(anyLong(), anyLong(), any());
        verify(messagingTemplate, never()).convertAndSendToUser(any(), any(), any());
    }

    private FittingDraftUpdateRequestDTO request() {
        return new FittingDraftUpdateRequestDTO(
                "request-uuid",
                17L,
                3L,
                new FittingDraftUpdateRequestDTO.Data(
                        List.of(),
                        new FittingDraftWearOptionsDTO("UNTUCKED", null, "ROLLED"),
                        "prompt"
                )
        );
    }

    private RoomPrincipal principal() {
        return new RoomPrincipal(42L, 31L, "친구", "PARTICIPANT");
    }
}
