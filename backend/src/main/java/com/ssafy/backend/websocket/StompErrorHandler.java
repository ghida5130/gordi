package com.ssafy.backend.websocket;

import com.ssafy.backend.common.error.ErrorCode;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.StompSubProtocolErrorHandler;

import java.nio.charset.StandardCharsets;

/**
 * STOMP 처리 중 발생한 예외를 클라이언트가 구분 가능한 ERROR frame으로 정제한다.
 * <p>
 * StompAuthChannelInterceptor가 던진 MessageDeliveryException의 cause 체인에서
 * ErrorCode name(UNAUTHORIZED / TOKEN_EXPIRED / INVALID_TOKEN 등)을 찾아
 * ERROR frame의 message 헤더로, ErrorCode의 한글 메시지를 body로 내려준다.
 * 매칭되는 ErrorCode가 없으면 INTERNAL_SERVER_ERROR로 응답한다.
 */
@Component
public class StompErrorHandler extends StompSubProtocolErrorHandler {

    // - 인자: 처리 실패한 클라이언트 frame, 발생 예외
    // - 동작: 예외에서 ErrorCode를 추출해 message 헤더/한글 메시지 body의 ERROR frame 생성
    @Override
    public Message<byte[]> handleClientMessageProcessingError(
            Message<byte[]> clientMessage, Throwable ex) {

        ErrorCode errorCode = resolveErrorCode(ex);

        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.ERROR);
        accessor.setMessage(errorCode.getCode());
        accessor.setLeaveMutable(true);

        return MessageBuilder.createMessage(
                errorCode.getMessage().getBytes(StandardCharsets.UTF_8),
                accessor.getMessageHeaders()
        );
    }

    // - 인자: 발생 예외
    // - 동작: cause 체인을 따라가며 메시지와 정확히 일치하는 ErrorCode를 우선 반환,
    //         없으면 메시지에 포함된 가장 긴 ErrorCode name 매칭. 그래도 없으면 INTERNAL_SERVER_ERROR
    private ErrorCode resolveErrorCode(Throwable ex) {
        // 1차: 예외 메시지가 ErrorCode name과 정확히 일치 (인터셉터가 code만 담아 던진 경우)
        for (Throwable t = ex; t != null; t = t.getCause()) {
            String message = t.getMessage();
            if (message == null) {
                continue;
            }
            for (ErrorCode code : ErrorCode.values()) {
                if (message.equals(code.getCode())) {
                    return code;
                }
            }
        }
        // 2차: 래핑된 예외 메시지 안에 포함된 code 탐색 (긴 name 우선 → CONFLICT/VERSION_CONFLICT 오매칭 방지)
        ErrorCode[] byLengthDesc = ErrorCode.values().clone();
        java.util.Arrays.sort(byLengthDesc,
                (a, b) -> b.getCode().length() - a.getCode().length());
        for (Throwable t = ex; t != null; t = t.getCause()) {
            String message = t.getMessage();
            if (message == null) {
                continue;
            }
            for (ErrorCode code : byLengthDesc) {
                if (message.contains(code.getCode())) {
                    return code;
                }
            }
        }
        return ErrorCode.INTERNAL_SERVER_ERROR;
    }
}
