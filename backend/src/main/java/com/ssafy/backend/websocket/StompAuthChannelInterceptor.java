package com.ssafy.backend.websocket;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.util.RoomTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * STOMP CONNECT frame의 Authorization 헤더에서 roomToken을 검증한다.
 * <p>
 * - 토큰이 없거나(UNAUTHORIZED), 만료(TOKEN_EXPIRED)/위조·타입불일치(INVALID_TOKEN)면
 *   예외를 던져 연결을 거절한다. 예외 메시지(ErrorCode name)는 STOMP ERROR frame의
 *   message 헤더로 클라이언트에 전달된다.
 * - 검증 성공 시 RoomPrincipal을 세션에 바인딩하고, Spring이 CONNECTED frame을 응답한다.
 */
@Component
@RequiredArgsConstructor
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final String BEARER_PREFIX = "Bearer ";

    private final RoomTokenProvider roomTokenProvider;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        // CONNECT 이외의 frame은 CONNECT 시점에 바인딩된 Principal을 그대로 사용
        if (accessor == null || !StompCommand.CONNECT.equals(accessor.getCommand())) {
            return message;
        }

        // 토큰 검증 및 예외처리
        String authorization = accessor.getFirstNativeHeader("Authorization");
        if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) {
            throw new MessageDeliveryException(ErrorCode.UNAUTHORIZED.getCode());
        }

        RoomTokenProvider.RoomClaims claims;
        try {
            claims = roomTokenProvider.parse(authorization.substring(BEARER_PREFIX.length()).trim());
        } catch (ApiException e) {
            // TOKEN_EXPIRED / INVALID_TOKEN 을 ERROR frame message 헤더로 구분 전달
            throw new MessageDeliveryException(e.getErrorCode().getCode());
        }

        // 세션 바인딩 - Room 전용 Principal 인터페이스 구현체
        RoomPrincipal principal = new RoomPrincipal(
                claims.participantId(),
                claims.roomId(),
                claims.nickname(),
                claims.role()
        );
        accessor.setUser(principal);

        // @MessageMapping 컨트롤러나 다른 인터셉터에서 접속자의 방 정보 꺼내쓰기
        Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
        if (sessionAttributes != null) {
            sessionAttributes.put("roomId", claims.roomId());
            sessionAttributes.put("participantId", claims.participantId());
        }

        return message;
    }
}
