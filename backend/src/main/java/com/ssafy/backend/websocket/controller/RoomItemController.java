package com.ssafy.backend.websocket.controller;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.websocket.RoomEventPublisher;
import com.ssafy.backend.websocket.RoomPrincipal;
import com.ssafy.backend.websocket.dto.ItemLockRejectedEventDataDTO;
import com.ssafy.backend.websocket.dto.ItemLockRequestDTO;
import com.ssafy.backend.websocket.dto.ItemLockedEventDataDTO;
import com.ssafy.backend.websocket.dto.ItemMoveRequestDTO;
import com.ssafy.backend.websocket.dto.RoomEventDTO;
import com.ssafy.backend.websocket.event.RoomEventType;
import com.ssafy.backend.websocket.service.RoomItemLockService;
import com.ssafy.backend.websocket.service.RoomItemLockService.ItemLock;
import com.ssafy.backend.websocket.service.RoomItemLockService.ItemLockResult;
import com.ssafy.backend.websocket.service.RoomItemMoveService;
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
 * 아이템 이동 SEND 처리.
 * 클라이언트: SEND /app/rooms/{roomId}/items/move
 * 성공 시: RoomEventPublisher가 커밋 후 /topic/v1/rooms/{roomId}/participants 로
 *          전체 placements를 담은 ITEM_MOVED 브로드캐스트
 * 버전 충돌 시: 요청자의 /user/queue/sync 로 최신 BOARD_SNAPSHOT을 재전송해
 *              클라이언트가 상태를 복구하고 재시도할 수 있게 한다.
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class RoomItemController {

    private static final String SYNC_QUEUE = "/queue/sync";
    private static final String ITEM_LOCK_QUEUE = "/queue/item-locks";
    private static final String ITEM_ALREADY_LOCKED = "ITEM_ALREADY_LOCKED";

    private final RoomItemMoveService roomItemMoveService;
    private final RoomItemLockService roomItemLockService;
    private final RoomSyncService roomSyncService;
    private final RoomEventPublisher roomEventPublisher;
    private final SimpMessagingTemplate messagingTemplate;

    // - 인자: 경로의 roomId, 이동 요청 body, 세션 Principal
    // - 동작: Principal의 방과 일치할 때만 이동 처리. VERSION_CONFLICT는 스냅샷 재전송,
    //         그 외 실패는 로그만 남기고 무시한다(연결 유지).
    @MessageMapping("/rooms/{roomId}/items/move")
    public void moveItem(
            @DestinationVariable Long roomId,
            @Payload ItemMoveRequestDTO request,
            Principal principal
    ) {
        if (!(principal instanceof RoomPrincipal roomPrincipal)) {
            log.warn("items/move 요청에 RoomPrincipal이 없어 무시: roomId={}", roomId);
            return;
        }
        if (!roomPrincipal.roomId().equals(roomId)) {
            log.warn("다른 방 items/move 요청 무시: requestedRoomId={}, principalRoomId={}, participantId={}",
                    roomId, roomPrincipal.roomId(), roomPrincipal.participantId());
            return;
        }

        try {
            roomItemMoveService.moveItem(roomId, roomPrincipal.participantId(), request);
        } catch (ApiException exception) {
            handleFailure(roomId, roomPrincipal, request, exception);
        }
    }

    // - 인자: 경로의 roomId, 잠금 요청 body(roomItemId/lockToken), 세션 Principal
    // - 동작: 잠금 획득 성공 시 lockToken을 제외한 ITEM_LOCKED를 방 토픽에 브로드캐스트,
    //         이미 다른 참여자가 보유 중이면 ITEM_LOCK_REJECTED를 요청자 개인 큐로만 전송.
    //         잠금은 방 버전을 증가시키지 않는다.
    @MessageMapping("/rooms/{roomId}/items/lock")
    public void lockItem(
            @DestinationVariable Long roomId,
            @Payload ItemLockRequestDTO request,
            Principal principal
    ) {
        if (!(principal instanceof RoomPrincipal roomPrincipal)) {
            log.warn("items/lock 요청에 RoomPrincipal이 없어 무시: roomId={}", roomId);
            return;
        }
        if (!roomPrincipal.roomId().equals(roomId)) {
            log.warn("다른 방 items/lock 요청 무시: requestedRoomId={}, principalRoomId={}, participantId={}",
                    roomId, roomPrincipal.roomId(), roomPrincipal.participantId());
            return;
        }

        ItemLockResult result;
        try {
            result = roomItemLockService.tryLock(
                    roomId,
                    roomPrincipal.participantId(),
                    roomPrincipal.nickname(),
                    request
            );
        } catch (ApiException exception) {
            log.warn("items/lock 처리 실패: roomId={}, participantId={}, errorCode={}",
                    roomId, roomPrincipal.participantId(), exception.getErrorCode().getCode());
            return;
        }

        ItemLock owner = result.owner();
        Long roomItemId = request.data().roomItemId();

        if (result.acquired()) {
            roomEventPublisher.publish(RoomEventDTO.of(
                    RoomEventType.ITEM_LOCKED,
                    request.clientEventId(),
                    roomId,
                    result.roomVersion(),
                    roomPrincipal.participantId(),
                    new ItemLockedEventDataDTO(roomItemId, owner.participantId(), owner.nickname())
            ));
            return;
        }

        messagingTemplate.convertAndSendToUser(
                roomPrincipal.getName(),
                ITEM_LOCK_QUEUE,
                RoomEventDTO.of(
                        RoomEventType.ITEM_LOCK_REJECTED,
                        request.clientEventId(),
                        roomId,
                        result.roomVersion(),
                        roomPrincipal.participantId(),
                        new ItemLockRejectedEventDataDTO(
                                roomItemId,
                                ITEM_ALREADY_LOCKED,
                                owner.participantId(),
                                owner.nickname()
                        )
                )
        );
    }

    // - 인자: 방 ID, 요청자 Principal, 원본 요청, 발생 예외
    // - 동작: VERSION_CONFLICT면 최신 스냅샷을 요청자 개인 큐로 재전송, 그 외는 로그
    private void handleFailure(
            Long roomId,
            RoomPrincipal roomPrincipal,
            ItemMoveRequestDTO request,
            ApiException exception
    ) {
        if (exception.getErrorCode() == ErrorCode.VERSION_CONFLICT) {
            log.info("items/move 버전 충돌 → 스냅샷 재전송: roomId={}, participantId={}, baseVersion={}",
                    roomId, roomPrincipal.participantId(), request.baseVersion());
            RoomEventDTO snapshot = roomSyncService.buildSnapshot(
                    roomId,
                    request.clientEventId(),
                    roomPrincipal.participantId()
            );
            messagingTemplate.convertAndSendToUser(roomPrincipal.getName(), SYNC_QUEUE, snapshot);
            return;
        }
        log.warn("items/move 처리 실패: roomId={}, participantId={}, errorCode={}",
                roomId, roomPrincipal.participantId(), exception.getErrorCode().getCode());
    }
}
