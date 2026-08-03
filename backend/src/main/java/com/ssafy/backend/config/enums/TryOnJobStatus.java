package com.ssafy.backend.config.enums;

// 착장 이미지 생성 Job 상태 (실패도 오류 응답이 아니라 FAILED 상태로 조회된다)
public enum TryOnJobStatus {

    QUEUED,
    RUNNING,
    SUCCEEDED,
    FAILED;

    public boolean matches(String status) {
        return name().equals(status);
    }

    // 결과 이미지가 확정된 상태인지 (스냅샷 확정 대상 판정)
    public boolean isSucceeded() {
        return this == SUCCEEDED;
    }

    // 더 이상 상태가 바뀌지 않는 상태인지
    public boolean isTerminal() {
        return this == SUCCEEDED || this == FAILED;
    }
}
