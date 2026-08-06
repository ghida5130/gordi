package com.ssafy.backend.websocket.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.websocket.dto.RoomStartRequestDTO;
import com.ssafy.backend.websocket.event.RoomStartedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 방 시작(ROOM_STARTED) 처리. HOST 전용.
 * <p>
 * WAITING → IN_PROGRESS 상태 전이와 버전 증가를 조건부 bulk UPDATE 한 문장으로
 * 원자적으로 수행한다(0행이면 VERSION_CONFLICT). 성공 시 RoomStartedEvent를 발행하고,
 * RoomEventPublisher가 커밋 후 방 토픽으로 브로드캐스트한다.
 */
@Service
@RequiredArgsConstructor
public class RoomStartService {

    private static final String HOST = "HOST";
    private static final String WAITING = "WAITING";
    private static final String IN_PROGRESS = "IN_PROGRESS";

    private final RoomRepository roomRepository;
    private final ApplicationEventPublisher eventPublisher;

    // - 인자: 방 ID, 요청자 participantId/role, 시작 요청(clientEventId/baseVersion)
    // - 동작: HOST 권한 → 방 상태(WAITING) → 버전 검증+상태 전이 → RoomStartedEvent 발행
    @Transactional
    public void start(Long roomId, Long senderParticipantId, String senderRole, RoomStartRequestDTO request) {
        validateRequest(request);

        if (!HOST.equals(senderRole)) {
            throw new ApiException(ErrorCode.FORBIDDEN, Map.of("requiredRole", HOST));
        }

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ApiException(ErrorCode.ROOM_NOT_FOUND));
        validateStartable(room);

        if (roomRepository.updateStatusIfVersionMatches(roomId, request.baseVersion(), IN_PROGRESS) == 0) {
            throw new ApiException(ErrorCode.VERSION_CONFLICT);
        }

        eventPublisher.publishEvent(new RoomStartedEvent(
                roomId,
                request.baseVersion() + 1,
                senderParticipantId,
                request.clientEventId()
        ));
    }

    private void validateStartable(Room room) {
        boolean expired = !room.getExpiresAt().isAfter(LocalDateTime.now(AppZone.KST));
        boolean closedStatus = "FINISHED".equals(room.getStatus())
                || "EXPIRED".equals(room.getStatus());
        if (expired || closedStatus) {
            throw new ApiException(ErrorCode.ROOM_CLOSED);
        }
        if (!WAITING.equals(room.getStatus())) {
            throw new ApiException(
                    ErrorCode.CONFLICT,
                    "WAITING 상태의 방만 시작할 수 있습니다.",
                    Map.of("status", room.getStatus())
            );
        }
    }

    private void validateRequest(RoomStartRequestDTO request) {
        if (request == null || request.baseVersion() == null) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
    }
}
