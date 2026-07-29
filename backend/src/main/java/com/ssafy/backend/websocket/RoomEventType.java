package com.ssafy.backend.websocket;

/**
 * 방 토픽(/topic/v1/rooms/{roomId}/participants)으로 브로드캐스트되는 이벤트 종류.
 */
public enum RoomEventType {
    PARTICIPANT_JOINED,
    PARTICIPANT_LEFT,
    ROOM_STARTED,
    ITEM_MOVED,
    TIER_RENAMED,
    TRY_ON_PROCESSING,
    TRY_ON_SUCCEEDED,
    TRY_ON_FAILED,
    ROOM_FINISHED,
    ROOM_EXPIRED
}
