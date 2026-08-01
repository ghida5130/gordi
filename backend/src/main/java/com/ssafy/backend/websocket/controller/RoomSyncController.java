package com.ssafy.backend.websocket.controller;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.websocket.RoomPrincipal;
import com.ssafy.backend.websocket.dto.RoomEventDTO;
import com.ssafy.backend.websocket.dto.RoomSyncRequestDTO;
import com.ssafy.backend.websocket.service.RoomSyncService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * 방 상태 동기화 SEND 처리.
 * 클라이언트: SEND /app/rooms/{roomId}/sync → 응답: /user/queue/sync (요청자만 수신)
 * <p>
 * 재연결·이벤트 유실 시 클라이언트가 최신 방 전체 스냅샷(BOARD_SNAPSHOT)을 받아
 * 로컬 상태를 재구성하는 용도. destination의 roomId는 신뢰하지 않고
 * CONNECT 때 바인딩된 RoomPrincipal의 roomId와 일치할 때만 처리한다.
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class RoomSyncController {

    private static final String SYNC_QUEUE = "/queue/sync";

    private final RoomSyncService roomSyncService;
    private final SimpMessagingTemplate messagingTemplate;

    // - 인자: 경로의 roomId, 요청 body(clientEventId, 생략 가능), 세션 Principal
    // - 동작: Principal의 방과 일치하면 스냅샷을 조립해 요청자 개인 큐로 전송.
    //         불일치/미인증 요청은 로그만 남기고 무시한다(연결 유지).
    @MessageMapping("/rooms/{roomId}/sync")
    public void sync(
            @DestinationVariable Long roomId,
            @Payload(required = false) RoomSyncRequestDTO request,
            Principal principal
    ) {
        if (!(principal instanceof RoomPrincipal roomPrincipal)) {
            log.warn("sync 요청에 RoomPrincipal이 없어 무시: roomId={}", roomId);
            return;
        }
        if (!roomPrincipal.roomId().equals(roomId)) {
            log.warn("다른 방 sync 요청 무시: requestedRoomId={}, principalRoomId={}, participantId={}",
                    roomId, roomPrincipal.roomId(), roomPrincipal.participantId());
            return;
        }

        RoomEventDTO snapshot = roomSyncService.buildSnapshot(
                roomId,
                request == null ? null : request.clientEventId(),
                roomPrincipal.participantId()
        );
        messagingTemplate.convertAndSendToUser(principal.getName(), SYNC_QUEUE, snapshot);
    }

    // - 인자: sync 처리 중 발생한 ApiException (예: ROOM_NOT_FOUND)
    // - 동작: 연결을 끊지 않도록 로그만 남기고 종료
    @MessageExceptionHandler(ApiException.class)
    public void handleApiException(ApiException exception, Principal principal) {
        log.warn("sync 처리 실패: errorCode={}, principal={}",
                exception.getErrorCode().getCode(),
                principal == null ? null : principal.getName());
    }
}
