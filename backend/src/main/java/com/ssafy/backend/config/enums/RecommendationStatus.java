package com.ssafy.backend.config.enums;

// 추천 스냅샷 상태 (빈 결과는 오류가 아니라 EMPTY)
public enum RecommendationStatus {

    READY,
    EMPTY;

    public boolean matches(String status) {
        return name().equals(status);
    }
}
