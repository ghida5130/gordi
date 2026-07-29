package com.ssafy.backend.websocket;

import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.util.RoomTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;

import java.time.LocalDateTime;
import java.util.HashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StompAuthChannelInterceptorTest {

    private static final String SECRET =
            "room-token-test-secret-key-with-at-least-32-bytes";

    private RoomTokenProvider roomTokenProvider;
    private StompAuthChannelInterceptor interceptor;

    @BeforeEach
    void setUp() {
        roomTokenProvider = new RoomTokenProvider(SECRET, 3_600_000L);
        interceptor = new StompAuthChannelInterceptor(roomTokenProvider);
    }

    private Message<byte[]> connectMessage(String authorizationHeader) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setSessionId("session-1");
        accessor.setSessionAttributes(new HashMap<>());
        if (authorizationHeader != null) {
            accessor.setNativeHeader("Authorization", authorizationHeader);
        }
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    @Test
    void 유효한_roomToken이면_RoomPrincipal이_바인딩된다() {
        String token = roomTokenProvider.createRoomToken(
                42L, 31L, "친구1", "PARTICIPANTS",
                LocalDateTime.now(AppZone.KST).plusHours(2)
        );

        Message<?> result = interceptor.preSend(connectMessage("Bearer " + token), null);

        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(result);
        assertThat(accessor.getUser()).isInstanceOf(RoomPrincipal.class);

        RoomPrincipal principal = (RoomPrincipal) accessor.getUser();
        assertThat(principal.participantId()).isEqualTo(42L);
        assertThat(principal.roomId()).isEqualTo(31L);
        assertThat(principal.nickname()).isEqualTo("친구1");
        assertThat(principal.role()).isEqualTo("PARTICIPANTS");
        assertThat(principal.getName()).isEqualTo("42");
        assertThat(accessor.getSessionAttributes()).containsEntry("roomId", 31L);
    }

    @Test
    void Authorization_헤더가_없으면_UNAUTHORIZED로_거절한다() {
        assertThatThrownBy(() -> interceptor.preSend(connectMessage(null), null))
                .isInstanceOf(MessageDeliveryException.class)
                .hasMessageContaining(ErrorCode.UNAUTHORIZED.getCode());
    }

    @Test
    void Bearer_형식이_아니면_UNAUTHORIZED로_거절한다() {
        assertThatThrownBy(() -> interceptor.preSend(connectMessage("Basic abc"), null))
                .isInstanceOf(MessageDeliveryException.class)
                .hasMessageContaining(ErrorCode.UNAUTHORIZED.getCode());
    }

    @Test
    void 만료된_토큰이면_TOKEN_EXPIRED로_거절한다() {
        // 만료 시각 = min(now + 0, 방 만료) → 즉시 만료
        RoomTokenProvider expiredProvider = new RoomTokenProvider(SECRET, 0L);
        String expired = expiredProvider.createRoomToken(
                42L, 31L, "친구1", "PARTICIPANTS",
                LocalDateTime.now(AppZone.KST).plusHours(2)
        );

        assertThatThrownBy(() -> interceptor.preSend(connectMessage("Bearer " + expired), null))
                .isInstanceOf(MessageDeliveryException.class)
                .hasMessageContaining(ErrorCode.TOKEN_EXPIRED.getCode());
    }

    @Test
    void 위조된_토큰이면_INVALID_TOKEN으로_거절한다() {
        assertThatThrownBy(() -> interceptor.preSend(connectMessage("Bearer not-a-jwt"), null))
                .isInstanceOf(MessageDeliveryException.class)
                .hasMessageContaining(ErrorCode.INVALID_TOKEN.getCode());
    }

    @Test
    void CONNECT가_아닌_frame은_검증없이_통과한다() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
        accessor.setSessionId("session-1");
        Message<byte[]> message =
                MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        Message<?> result = interceptor.preSend(message, null);

        assertThat(result).isSameAs(message);
    }
}
