package com.ssafy.backend.websocket;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

/** Spring WebSocket 세션 이벤트를 참가자 세션 레지스트리에 전달한다. */
@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketSessionEventListener {

    private final RoomSessionRegistry roomSessionRegistry;

    @EventListener
    public void handleConnected(SessionConnectedEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        if (!(event.getUser() instanceof RoomPrincipal principal)) {
            log.debug("RoomPrincipal 없는 CONNECTED 이벤트 무시: sessionId={}", accessor.getSessionId());
            return;
        }
        roomSessionRegistry.connected(
                principal.roomId(),
                principal.participantId(),
                accessor.getSessionId()
        );
    }

    @EventListener
    public void handleDisconnected(SessionDisconnectEvent event) {
        if (!(event.getUser() instanceof RoomPrincipal principal)) {
            log.debug("RoomPrincipal 없는 DISCONNECT 이벤트 무시: sessionId={}", event.getSessionId());
            return;
        }
        roomSessionRegistry.disconnected(
                principal.roomId(),
                principal.participantId(),
                event.getSessionId()
        );
    }
}
