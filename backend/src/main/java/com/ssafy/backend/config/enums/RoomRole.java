package com.ssafy.backend.config.enums;

// 방 참가자 역할 (RoomParticipant.role 에 문자열로 저장된다)
public enum RoomRole {

    HOST,
    PARTICIPANTS;

    public boolean matches(String role) {
        return name().equals(role);
    }
}
