package com.ssafy.backend.config.enums;

// 외부 생성 서비스가 콜백으로 전달하는 이벤트 종류
public enum TryOnJobEventType {

    PROCESSING,
    SUCCEEDED,
    FAILED;

    public boolean matches(String eventType) {
        return name().equals(eventType);
    }
}
