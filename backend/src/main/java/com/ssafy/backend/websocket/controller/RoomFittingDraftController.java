package com.ssafy.backend.websocket.controller;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.websocket.RoomPrincipal;
import com.ssafy.backend.websocket.dto.FittingDraftUpdateRequestDTO;
import com.ssafy.backend.websocket.dto.RoomEventDTO;
import com.ssafy.backend.websocket.service.FittingDraftService;
import com.ssafy.backend.websocket.service.RoomSyncService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * 공유 피팅 초안 전체 스냅샷 SEND 처리.
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class RoomFittingDraftController {

    private static final String SYNC_QUEUE = "/queue/sync";

    private final FittingDraftService fittingDraftService;
    private final RoomSyncService roomSyncService;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/rooms/{roomId}/fitting-draft/update")
    public void update(
            @DestinationVariable Long roomId,
            @Payload FittingDraftUpdateRequestDTO request,
            Principal principal
    ) {
        if (!(principal instanceof RoomPrincipal roomPrincipal)) {
            log.warn("fitting-draft/update 요청에 RoomPrincipal이 없어 무시: roomId={}", roomId);
            return;
        }
        if (!roomPrincipal.roomId().equals(roomId)) {
            log.warn(
                    "다른 방 fitting-draft/update 요청 무시: requestedRoomId={}, principalRoomId={}, participantId={}",
                    roomId,
                    roomPrincipal.roomId(),
                    roomPrincipal.participantId()
            );
            return;
        }

        try {
            fittingDraftService.update(roomId, roomPrincipal.participantId(), request);
        } catch (ApiException exception) {
            handleFailure(roomId, roomPrincipal, request, exception);
        }
    }

    private void handleFailure(
            Long roomId,
            RoomPrincipal roomPrincipal,
            FittingDraftUpdateRequestDTO request,
            ApiException exception
    ) {
        if (exception.getErrorCode() == ErrorCode.VERSION_CONFLICT) {
            log.info(
                    "fitting-draft/update 버전 충돌 → 스냅샷 재전송: roomId={}, participantId={}, baseVersion={}, baseDraftRevision={}",
                    roomId,
                    roomPrincipal.participantId(),
                    request.baseVersion(),
                    request.baseDraftRevision()
            );
            RoomEventDTO snapshot = roomSyncService.buildSnapshot(
                    roomId,
                    request.clientEventId(),
                    roomPrincipal.participantId()
            );
            messagingTemplate.convertAndSendToUser(roomPrincipal.getName(), SYNC_QUEUE, snapshot);
            return;
        }
        log.warn(
                "fitting-draft/update 처리 실패: roomId={}, participantId={}, errorCode={}",
                roomId,
                roomPrincipal.participantId(),
                exception.getErrorCode().getCode()
        );
    }
}
