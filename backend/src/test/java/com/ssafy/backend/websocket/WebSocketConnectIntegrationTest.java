package com.ssafy.backend.websocket;

import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.repository.RoomParticipantRepository;
import com.ssafy.backend.util.RoomTokenProvider;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.messaging.converter.StringMessageConverter;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/**
 * STOMP CONNECT 인증 통합 테스트.
 * 임베디드 서버(RANDOM_PORT)에 실제 WebSocket으로 연결해
 * 핸드셰이크(permitAll) → CONNECT 검증 → CONNECTED/ERROR frame 응답까지 전 구간을 검증한다.
 * DB는 H2 인메모리로 대체하므로 MySQL 없이 실행 가능하다. (JWT_SECRET 등 .env는 필요)
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "spring.datasource.url=jdbc:h2:mem:ws-connect-test;MODE=MySQL;DATABASE_TO_LOWER=TRUE",
                "spring.datasource.driver-class-name=org.h2.Driver",
                "spring.datasource.username=sa",
                "spring.datasource.password=",
                "spring.jpa.hibernate.ddl-auto=create-drop",
                "spring.jpa.show-sql=false"
        }
)
class WebSocketConnectIntegrationTest {

    private static final long TIMEOUT_SECONDS = 5;

    // Boot 버전 간 @LocalServerPort 패키지 이동 이슈를 피하기 위해 프로퍼티로 주입
    @Value("${local.server.port}")
    private int port;

    @Autowired
    private RoomTokenProvider roomTokenProvider;

    @MockitoBean
    private RoomParticipantRepository roomParticipantRepository;

    @Value("${jwt.secret}")
    private String secret;

    private WebSocketStompClient stompClient;

    @BeforeEach
    void setUp() {
        when(roomParticipantRepository.existsByIdAndRoomIdAndLeftAtIsNull(42L, 31L))
                .thenReturn(true);
        stompClient = new WebSocketStompClient(new StandardWebSocketClient());
        stompClient.setMessageConverter(new StringMessageConverter());
    }

    @AfterEach
    void tearDown() {
        stompClient.stop();
    }

    private String url() {
        return "ws://localhost:" + port + "/ws/v1";
    }

    /** 연결 시도 결과: 세션 future + (거절 시) ERROR frame의 message 헤더 */
    private record ConnectAttempt(
            CompletableFuture<StompSession> session,
            CompletableFuture<String> errorMessage
    ) {}

    private ConnectAttempt connect(String authorizationHeader) {
        CompletableFuture<String> errorMessage = new CompletableFuture<>();

        StompHeaders connectHeaders = new StompHeaders();
        if (authorizationHeader != null) {
            connectHeaders.add("Authorization", authorizationHeader);
        }

        CompletableFuture<StompSession> session = stompClient.connectAsync(
                url(),
                new WebSocketHttpHeaders(),
                connectHeaders,
                new StompSessionHandlerAdapter() {
                    // CONNECTED 이전에 수신되는 frame은 ERROR frame
                    @Override
                    public void handleFrame(StompHeaders headers, Object payload) {
                        errorMessage.complete(headers.getFirst("message"));
                    }
                }
        );
        return new ConnectAttempt(session, errorMessage);
    }

    private String validToken() {
        return roomTokenProvider.createRoomToken(
                42L, 31L, "친구1", "PARTICIPANTS",
                LocalDateTime.now(AppZone.KST).plusHours(2)
        );
    }

    @Test
    void 유효한_roomToken이면_CONNECTED_frame을_받고_세션이_연결된다() throws Exception {
        StompSession session = connect("Bearer " + validToken())
                .session()
                .get(TIMEOUT_SECONDS, TimeUnit.SECONDS);

        assertThat(session.isConnected()).isTrue();
        session.disconnect();
    }

    @Test
    void Authorization_헤더가_없으면_UNAUTHORIZED_ERROR_frame으로_거절된다() throws Exception {
        ConnectAttempt attempt = connect(null);

        String message = attempt.errorMessage().get(TIMEOUT_SECONDS, TimeUnit.SECONDS);

        assertThat(message).contains(ErrorCode.UNAUTHORIZED.getCode());
        assertThatThrownBy(() -> attempt.session().get(TIMEOUT_SECONDS, TimeUnit.SECONDS))
                .isInstanceOf(Exception.class); // 연결 종료로 세션 future 실패
    }

    @Test
    void 만료된_토큰이면_TOKEN_EXPIRED_ERROR_frame으로_거절된다() throws Exception {
        // 만료 시간 0ms 발급기로 즉시 만료 토큰 생성 (서명 키는 동일)
        RoomTokenProvider expiredProvider = new RoomTokenProvider(secret, 0L);
        String expired = expiredProvider.createRoomToken(
                42L, 31L, "친구1", "PARTICIPANTS",
                LocalDateTime.now(AppZone.KST).plusHours(2)
        );

        String message = connect("Bearer " + expired)
                .errorMessage()
                .get(TIMEOUT_SECONDS, TimeUnit.SECONDS);

        assertThat(message).contains(ErrorCode.TOKEN_EXPIRED.getCode());
    }

    @Test
    void type이_room이_아닌_토큰이면_INVALID_TOKEN으로_거절된다() throws Exception {
        // 동일 키로 서명했지만 type=access → access/room 토큰 교차 사용 차단 검증
        String accessLikeToken = Jwts.builder()
                .subject("42")
                .claim("roomId", 31L)
                .claim("type", "access")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)))
                .compact();

        String message = connect("Bearer " + accessLikeToken)
                .errorMessage()
                .get(TIMEOUT_SECONDS, TimeUnit.SECONDS);

        assertThat(message).contains(ErrorCode.INVALID_TOKEN.getCode());
    }

    @Test
    void 위조된_토큰이면_INVALID_TOKEN으로_거절된다() throws Exception {
        String message = connect("Bearer not-a-jwt")
                .errorMessage()
                .get(TIMEOUT_SECONDS, TimeUnit.SECONDS);

        assertThat(message).contains(ErrorCode.INVALID_TOKEN.getCode());
    }
}
