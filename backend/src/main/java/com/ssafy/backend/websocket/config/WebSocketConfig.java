package com.ssafy.backend.websocket.config;

import com.ssafy.backend.websocket.StompAuthChannelInterceptor;
import com.ssafy.backend.websocket.StompErrorHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * STOMP WebSocket 설정.
 * - 엔드포인트: /ws/v1 (클라이언트는 wss://{host}/ws/v1 로 접속, nginx가 백엔드로 프록시)
 * - 브로커: SimpleBroker(인메모리). 스케일아웃 시 RabbitMQ StompBrokerRelay로 교체 예정.
 * - 인증: CONNECT frame의 Authorization 헤더를 StompAuthChannelInterceptor에서 검증, inbound 채널에 인증 인터셉터 등록
 * - 에러: StompErrorHandler가 예외를 ErrorCode 기반 ERROR frame으로 정제해 응답
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompAuthChannelInterceptor stompAuthChannelInterceptor;
    private final StompErrorHandler stompErrorHandler;

    // 웹소켓 연결(HandShake) 진입점 설정 + ERROR frame 핸들러 등록
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.setErrorHandler(stompErrorHandler);
        registry.addEndpoint("/ws/v1")
                .setAllowedOriginPatterns("*"); // CORS 설정 TODO: 운영 배포 시 실제 도메인으로 제한
    }

    // 메시지 브로커 구성 _ 메시지 라우팅 방식, 브로커 동작 정의
    // SimpleBroker 활성화, Heartbeat 설정
    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue") // 구독 목적지 prefix
                .setHeartbeatValue(new long[]{10000, 10000}) // heart-beat: 연결이 유효한지 10초 간격으로 Ping/Pong
                .setTaskScheduler(webSocketHeartbeatScheduler()); // SimpleBroker heartbeat에 필수
        registry.setApplicationDestinationPrefixes("/app"); // /app/chat -> @MessageMapping("/chat") -> 브로커 (SEND)
        registry.setUserDestinationPrefix("/user"); // 특정 개별 사용자 개인 알림 prefix
    }

    // 인바운드 채널 인터셉터
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(stompAuthChannelInterceptor);
    }

    @Bean
    public TaskScheduler webSocketHeartbeatScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("ws-heartbeat-");
        scheduler.initialize();
        return scheduler;
    }

    @Bean
    public TaskScheduler roomDisconnectScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("room-disconnect-");
        scheduler.initialize();
        return scheduler;
    }
}
