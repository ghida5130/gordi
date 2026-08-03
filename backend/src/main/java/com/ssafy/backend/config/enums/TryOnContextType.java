package com.ssafy.backend.config.enums;

/**
 * 착장 Job 생성 컨텍스트.
 * SOLO 는 방 없이 회원 개인이 요청하고, ROOM 은 방 참가자가 방의 보드를 대상으로 요청한다.
 */
public enum TryOnContextType {

    SOLO,
    ROOM;

    public boolean matches(String type) {
        return name().equals(type);
    }

    public boolean isRoom() {
        return this == ROOM;
    }
}
