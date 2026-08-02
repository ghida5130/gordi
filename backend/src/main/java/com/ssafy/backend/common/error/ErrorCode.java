package com.ssafy.backend.common.error;

import org.springframework.http.HttpStatus;

public enum ErrorCode {

    BAD_REQUEST(HttpStatus.BAD_REQUEST, "요청 형식이 올바르지 않습니다.", false),
    INVALID_BUDGET_RANGE(HttpStatus.BAD_REQUEST, "최소 예산은 최대 예산보다 클 수 없습니다.", false),
    INVALID_NICKNAME(HttpStatus.BAD_REQUEST, "닉네임 형식이 올바르지 않습니다.", false),

    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "인증이 필요합니다.", false),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 일치하지 않습니다.", false),
    TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "토큰이 만료되었습니다.", false),
    INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "유효하지 않은 토큰입니다.", false),

    FORBIDDEN(HttpStatus.FORBIDDEN, "요청한 리소스에 접근할 권한이 없습니다.", false),

    RESOURCE_NOT_FOUND(HttpStatus.NOT_FOUND, "요청한 리소스를 찾을 수 없습니다.", false),
    AVATAR_NOT_FOUND(HttpStatus.NOT_FOUND, "활성 아바타 프리셋을 찾을 수 없습니다.", false),
    ROOM_NOT_FOUND(HttpStatus.NOT_FOUND, "방을 찾을 수 없습니다.", false),
    RESULT_NOT_FOUND(HttpStatus.NOT_FOUND, "방 결과를 찾을 수 없습니다.", false),

    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "지원하지 않는 HTTP 메서드입니다.", false),
    CONTENT_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "요청 본문이 허용 크기를 초과했습니다.", false),
    UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "지원하지 않는 미디어 타입입니다.", false),

    CONFLICT(HttpStatus.CONFLICT, "요청이 현재 리소스 상태와 충돌합니다.", false),
    NICKNAME_ALREADY_EXISTS(HttpStatus.CONFLICT, "이미 사용 중인 닉네임입니다.", false),
    ROOM_FULL(HttpStatus.CONFLICT, "방의 최대 인원을 초과했습니다.", false),
    ALREADY_JOINED(HttpStatus.CONFLICT, "이미 참여 중인 방입니다.", false),
    VERSION_CONFLICT(HttpStatus.CONFLICT, "최신 상태와 버전이 일치하지 않습니다.", false),
    JOB_NOT_RETRYABLE(HttpStatus.CONFLICT, "재시도할 수 없는 작업입니다.", false),
    IDEMPOTENCY_KEY_REUSED(HttpStatus.CONFLICT, "동일한 멱등 키가 다른 요청에 사용되었습니다.", false),

    ROOM_CLOSED(HttpStatus.GONE, "이미 종료된 방입니다.", false),
    GENERATION_QUOTA_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS, "이미지 생성 한도를 초과했습니다.", true),

    DEPENDENCY_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "외부 의존 서비스를 사용할 수 없습니다.", true),
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 내부 오류가 발생했습니다.", false);

    private final HttpStatus status;
    private final String message;
    private final boolean retryable;

    ErrorCode(HttpStatus status, String message, boolean retryable) {
        this.status = status;
        this.message = message;
        this.retryable = retryable;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return name();
    }

    public String getMessage() {
        return message;
    }

    public boolean isRetryable() {
        return retryable;
    }
}
