package com.ssafy.backend.websocket;

import com.ssafy.backend.websocket.event.ParticipantLeaveReason;
import com.ssafy.backend.websocket.service.RoomLeaveService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

/**
 * 단일 서버에서 참가자의 현재 STOMP 세션과 연결 종료 유예 작업을 관리한다.
 * 스케일아웃 시 세션 소유권과 지연 작업을 Redis 등 공유 저장소로 이전해야 한다.
 */
@Slf4j
@Component
public class RoomSessionRegistry {

    private record ParticipantKey(Long roomId, Long participantId) {
    }

    private record SessionState(String sessionId, ScheduledFuture<?> pendingDisconnect) {
    }

    private final ConcurrentHashMap<ParticipantKey, SessionState> sessions = new ConcurrentHashMap<>();
    private final TaskScheduler taskScheduler;
    private final RoomLeaveService roomLeaveService;
    private final long disconnectGraceMillis;

    public RoomSessionRegistry(
            @Qualifier("roomDisconnectScheduler") TaskScheduler taskScheduler,
            RoomLeaveService roomLeaveService,
            @Value("${room.disconnect-grace-period:15000}") long disconnectGraceMillis
    ) {
        if (disconnectGraceMillis < 0) {
            throw new IllegalArgumentException("room.disconnect-grace-period는 0 이상이어야 합니다.");
        }
        this.taskScheduler = taskScheduler;
        this.roomLeaveService = roomLeaveService;
        this.disconnectGraceMillis = disconnectGraceMillis;
    }

    /** 새 연결을 현재 세션으로 등록하고 이전 세션의 예약된 퇴장을 취소한다. */
    public void connected(Long roomId, Long participantId, String sessionId) {
        if (roomId == null || participantId == null || sessionId == null) {
            return;
        }
        ParticipantKey key = new ParticipantKey(roomId, participantId);
        sessions.compute(key, (ignored, current) -> {
            cancel(current == null ? null : current.pendingDisconnect());
            return new SessionState(sessionId, null);
        });
    }

    /** 현재 세션의 종료에만 유예 작업을 하나 예약한다. */
    public void disconnected(Long roomId, Long participantId, String sessionId) {
        if (roomId == null || participantId == null || sessionId == null) {
            return;
        }
        ParticipantKey key = new ParticipantKey(roomId, participantId);
        sessions.computeIfPresent(key, (ignored, current) -> {
            if (!current.sessionId().equals(sessionId) || current.pendingDisconnect() != null) {
                return current;
            }
            ScheduledFuture<?> future = Objects.requireNonNull(taskScheduler.schedule(
                    () -> expireDisconnectedSession(key, sessionId),
                    Instant.now().plusMillis(disconnectGraceMillis)
            ));
            return new SessionState(sessionId, future);
        });
    }

    public boolean isCurrentSession(Long roomId, Long participantId, String sessionId) {
        SessionState current = sessions.get(new ParticipantKey(roomId, participantId));
        return current != null && current.sessionId().equals(sessionId);
    }

    private void expireDisconnectedSession(ParticipantKey key, String sessionId) {
        SessionState current = sessions.get(key);
        if (current == null || !current.sessionId().equals(sessionId)) {
            return;
        }
        if (!sessions.remove(key, current)) {
            return;
        }

        try {
            roomLeaveService.leave(
                    key.roomId(),
                    key.participantId(),
                    null,
                    ParticipantLeaveReason.CONNECTION_LOST
            );
        } catch (RuntimeException exception) {
            log.error("연결 유실 퇴장 처리 실패: roomId={}, participantId={}",
                    key.roomId(), key.participantId(), exception);
        }
    }

    private void cancel(ScheduledFuture<?> future) {
        if (future != null) {
            future.cancel(false);
        }
    }
}
