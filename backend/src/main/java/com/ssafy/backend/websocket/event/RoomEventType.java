package com.ssafy.backend.websocket.event;

/**
 * 방 토픽(/topic/v1/rooms/{roomId}/participants) 브로드캐스트 및
 * 개인 큐(/user/queue/sync) 응답에 사용되는 이벤트 종류.
 */
public enum RoomEventType {
    BOARD_SNAPSHOT,
    PARTICIPANT_JOINED,
    PARTICIPANT_LEFT,
    ROOM_STARTED,
    ITEM_MOVED,
    ITEM_LOCKED,
    ITEM_LOCK_REJECTED,
    TIER_RENAMED,
    TRY_ON_PROCESSING,
    TRY_ON_SUCCEEDED,
    TRY_ON_FAILED,
    ROOM_FINISHED,
    ROOM_EXPIRED
}
