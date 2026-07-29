package com.ssafy.backend.websocket;

import java.security.Principal;

/**
 * WebSocket 세션에 바인딩되는 방 참가자 Principal.
 * getName()이 participantId를 반환하므로
 * convertAndSendToUser(String.valueOf(participantId), ...) 로 개인 메시지 라우팅이 가능하다.
 */
public record RoomPrincipal(
        Long participantId,
        Long roomId,
        String nickname,
        String role
) implements Principal {

    @Override
    public String getName() {
        return String.valueOf(participantId);
    }
}
