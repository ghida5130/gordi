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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * STOMP CONNECT frame의 Authorization 헤더에서 roomToken을 검증한다.
 * <p>
 * - 토큰이 없거나(UNAUTHORIZED), 만료(TOKEN_EXPIRED)/위조·타입불일치(INVALID_TOKEN)면
 *   예외를 던져 연결을 거절한다. 예외 메시지(ErrorCode name)는 STOMP ERROR frame의
 *   message 헤더로 클라이언트에 전달된다.
 * - 검증 성공 시 RoomPrincipal을 세션에 바인딩하고, Spring이 CONNECTED frame을 응답한다.
 * <p>
 * SUBSCRIBE frame은 목적지 권한을 검증한다.
 * - /user/queue/** : Spring이 세션 단위로 라우팅하므로 통과
 * - /topic/v1/rooms/{roomId}/** : Principal의 roomId와 일치해야 통과, 불일치 시 FORBIDDEN
 * - 그 외 목적지: FORBIDDEN
 */
@Component
@RequiredArgsConstructor
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final String BEARER_PREFIX = "Bearer ";
    private static final String USER_QUEUE_PREFIX = "/user/queue/";
    private static final Pattern ROOM_TOPIC_PATTERN =
            Pattern.compile("^/topic/v1/rooms/(\\d+)(/.*)?$");

    private final RoomTokenProvider roomTokenProvider;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor == null) {
            return message;
        }

        // SUBSCRIBE는 목적지 권한 검증
        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            validateSubscription(accessor);
            return message;
        }

        // CONNECT/SUBSCRIBE 이외의 frame은 CONNECT 시점에 바인딩된 Principal을 그대로 사용
        if (!StompCommand.CONNECT.equals(accessor.getCommand())) {
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

    // - 인자: SUBSCRIBE frame accessor
    // - 동작: 개인 큐는 통과, 방 토픽은 Principal roomId 일치 검증, 그 외 목적지는 거절.
    //         예외는 StompErrorHandler가 ERROR frame으로 변환한다.
    private void validateSubscription(StompHeaderAccessor accessor) {
        String destination = accessor.getDestination();
        if (destination == null) {
            throw new MessageDeliveryException(ErrorCode.BAD_REQUEST.getCode());
        }

        // 개인 큐(/user/queue/**)는 브로커가 세션 단위로 라우팅하므로 추가 검증 불필요
        if (destination.startsWith(USER_QUEUE_PREFIX)) {
            return;
        }

        Matcher matcher = ROOM_TOPIC_PATTERN.matcher(destination);
        if (!matcher.matches()) {
            throw new MessageDeliveryException(ErrorCode.FORBIDDEN.getCode());
        }

        if (!(accessor.getUser() instanceof RoomPrincipal principal)) {
            throw new MessageDeliveryException(ErrorCode.UNAUTHORIZED.getCode());
        }
        long requestedRoomId = Long.parseLong(matcher.group(1));
        if (!principal.roomId().equals(requestedRoomId)) {
            throw new MessageDeliveryException(ErrorCode.FORBIDDEN.getCode());
        }
    }
}
