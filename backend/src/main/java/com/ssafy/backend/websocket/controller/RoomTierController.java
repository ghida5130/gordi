package com.ssafy.backend.websocket.controller;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.websocket.RoomPrincipal;
import com.ssafy.backend.websocket.dto.RoomEventDTO;
import com.ssafy.backend.websocket.dto.TierRenameRequestDTO;
import com.ssafy.backend.websocket.service.RoomSyncService;
import com.ssafy.backend.websocket.service.TierRenameService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * 티어 SEND 처리 (이름 변경 등).
 * 클라이언트: SEND /app/rooms/{roomId}/tiers/rename (HOST 전용)
 * 성공 시: RoomEventPublisher가 커밋 후 /topic/v1/rooms/{roomId}/participants 로
 *          TIER_RENAMED 브로드캐스트
 * 버전 충돌 시: 요청자의 /user/queue/sync 로 최신 BOARD_SNAPSHOT 재전송
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class RoomTierController {

    private static final String SYNC_QUEUE = "/queue/sync";

    private final TierRenameService tierRenameService;
    private final RoomSyncService roomSyncService;
    private final SimpMessagingTemplate messagingTemplate;

    // - 인자: 경로의 roomId, 이름 변경 요청 body, 세션 Principal
    // - 동작: Principal의 방과 일치할 때만 처리. VERSION_CONFLICT는 스냅샷 재전송,
    //         그 외 실패(권한 없음 포함)는 로그만 남기고 무시한다(연결 유지).
    @MessageMapping("/rooms/{roomId}/tiers/rename")
    public void rename(
            @DestinationVariable Long roomId,
            @Payload TierRenameRequestDTO request,
            Principal principal
    ) {
        if (!(principal instanceof RoomPrincipal roomPrincipal)) {
            log.warn("tiers/rename 요청에 RoomPrincipal이 없어 무시: roomId={}", roomId);
            return;
        }
        if (!roomPrincipal.roomId().equals(roomId)) {
            log.warn("다른 방 tiers/rename 요청 무시: requestedRoomId={}, principalRoomId={}, participantId={}",
                    roomId, roomPrincipal.roomId(), roomPrincipal.participantId());
            return;
        }

        try {
            tierRenameService.rename(
                    roomId,
                    roomPrincipal.participantId(),
                    roomPrincipal.role(),
                    request
            );
        } catch (ApiException exception) {
            handleFailure(roomId, roomPrincipal, request, exception);
        }
    }

    private void handleFailure(
            Long roomId,
            RoomPrincipal roomPrincipal,
            TierRenameRequestDTO request,
            ApiException exception
    ) {
        if (exception.getErrorCode() == ErrorCode.VERSION_CONFLICT) {
            log.info("tiers/rename 버전 충돌 → 스냅샷 재전송: roomId={}, participantId={}, baseVersion={}",
                    roomId, roomPrincipal.participantId(), request.baseVersion());
            RoomEventDTO snapshot = roomSyncService.buildSnapshot(
                    roomId,
                    request.clientEventId(),
                    roomPrincipal.participantId()
            );
            messagingTemplate.convertAndSendToUser(roomPrincipal.getName(), SYNC_QUEUE, snapshot);
            return;
        }
        log.warn("tiers/rename 처리 실패: roomId={}, participantId={}, errorCode={}",
                roomId, roomPrincipal.participantId(), exception.getErrorCode().getCode());
    }
}
