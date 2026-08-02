package com.ssafy.backend.websocket.controller;

import com.ssafy.backend.websocket.RoomPrincipal;
import com.ssafy.backend.websocket.dto.CursorMoveRequestDTO;
import com.ssafy.backend.websocket.dto.CursorPositionDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * 커서 위치 공유 SEND 처리.
 * 클라이언트: SEND /app/rooms/{roomId}/cursor (body: {x, y})
 * 브로드캐스트: /topic/v1/rooms/{roomId}/cursors 로 {participantId, x, y}
 * <p>
 * 고빈도 휘발성 데이터라 DB 저장·버전 관리·envelope 없이 즉시 브로드캐스트한다.
 * participantId는 클라이언트 값을 믿지 않고 세션 Principal에서 채운다.
 * 전송 빈도 제한(throttle)은 클라이언트 책임이다.
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class RoomCursorController {

    private static final String CURSOR_TOPIC_FORMAT = "/topic/v1/rooms/%d/cursors";

    private final SimpMessagingTemplate messagingTemplate;

    // - 인자: 경로의 roomId, 커서 좌표 body, 세션 Principal
    // - 동작: Principal의 방과 일치하고 좌표가 유효하면 [0,1]로 클램프해 방 커서 토픽으로 브로드캐스트.
    //         유효하지 않은 요청은 조용히 무시한다(고빈도 특성상 로그도 debug 수준).
    @MessageMapping("/rooms/{roomId}/cursor")
    public void moveCursor(
            @DestinationVariable Long roomId,
            @Payload CursorMoveRequestDTO request,
            Principal principal
    ) {
        if (!(principal instanceof RoomPrincipal roomPrincipal)
                || !roomPrincipal.roomId().equals(roomId)) {
            log.debug("권한 없는 cursors 요청 무시: roomId={}", roomId);
            return;
        }
        if (!isValidCoordinate(request)) {
            log.debug("잘못된 커서 좌표 무시: roomId={}, participantId={}",
                    roomId, roomPrincipal.participantId());
            return;
        }

        messagingTemplate.convertAndSend(
                CURSOR_TOPIC_FORMAT.formatted(roomId),
                new CursorPositionDTO(
                        roomPrincipal.participantId(),
                        clamp(request.x()),
                        clamp(request.y())
                )
        );
    }

    private boolean isValidCoordinate(CursorMoveRequestDTO request) {
        return request != null
                && request.x() != null && Double.isFinite(request.x())
                && request.y() != null && Double.isFinite(request.y());
    }

    private double clamp(double value) {
        return Math.max(0.0, Math.min(1.0, value));
    }
}
