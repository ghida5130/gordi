package com.ssafy.backend.websocket.dto;

/**
 * SEND /app/rooms/{roomId}/items/lock 요청 body.
 * - lockToken: 클라이언트가 생성한 잠금 식별 토큰. 서버에 저장만 하고
 *   절대 다른 사용자에게 브로드캐스트하지 않는다.
 * - participantId는 body로 받지 않고 RoomPrincipal에서 채운다.
 * - 잠금은 방 버전(baseVersion)을 증가시키지 않는다.
 */
public record ItemLockRequestDTO(
        String clientEventId,
        ItemLockDataDTO data
) {

    public record ItemLockDataDTO(
            Long roomItemId,
            String lockToken
    ) {
    }
}
