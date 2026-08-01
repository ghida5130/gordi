package com.ssafy.backend.websocket.event;

/**
 * ITEM_UNLOCKED 이벤트의 해제 사유.
 * - MOVE_COMPLETED: 이동 성공 후 서버 자동 해제
 * - CANCELLED: 드래그 취소로 인한 해제 (items/unlock 요청)
 * - RELEASED: 기타 수동 해제
 */
public enum ItemUnlockReason {
    MOVE_COMPLETED,
    CANCELLED,
    RELEASED
}
