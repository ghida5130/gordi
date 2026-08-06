package com.ssafy.backend.websocket.service;

import com.ssafy.backend.common.aop.BusinessOperation;
import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.Tier;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.repository.TierRepository;
import com.ssafy.backend.websocket.dto.TierRenameRequestDTO;
import com.ssafy.backend.websocket.event.TierRenamedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 티어 이름 변경(TIER_RENAMED) 처리. HOST 전용.
 * <p>
 * 버전 검증+증가는 조건부 bulk UPDATE(bumpVersionIfMatches)로 원자적으로 수행하고,
 * 이름 변경은 Tier 엔티티 dirty-check로 반영한다(Tier에는 @Version이 없어 안전).
 * 성공 시 TierRenamedEvent를 발행하고, RoomEventPublisher가 커밋 후 브로드캐스트한다.
 */
@Service
@RequiredArgsConstructor
public class TierRenameService {

    private static final String HOST = "HOST";
    private static final int MAX_NAME_LENGTH = 100;

    private final RoomRepository roomRepository;
    private final TierRepository tierRepository;
    private final ApplicationEventPublisher eventPublisher;

    // - 인자: 방 ID, 요청자 participantId/role, 변경 요청(clientEventId/baseVersion/data)
    // - 동작: HOST 권한 → 방 상태 → 티어 소속 → 버전 검증 → 이름 변경 → TierRenamedEvent 발행
    @BusinessOperation(value = "room.tier.rename", slowThresholdMs = 500)
    @Transactional
    public void rename(Long roomId, Long senderParticipantId, String senderRole, TierRenameRequestDTO request) {
        String name = validateRequest(request);

        if (!HOST.equals(senderRole)) {
            throw new ApiException(ErrorCode.FORBIDDEN, Map.of("requiredRole", HOST));
        }

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ApiException(ErrorCode.ROOM_NOT_FOUND));
        validateActive(room);

        Tier tier = tierRepository.findById(request.data().tierId())
                .orElseThrow(() -> new ApiException(
                        ErrorCode.RESOURCE_NOT_FOUND,
                        Map.of("resource", "tier")
                ));
        if (!tier.getRoom().getId().equals(roomId)) {
            throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND, Map.of("resource", "tier"));
        }

        if (roomRepository.bumpVersionIfMatches(roomId, request.baseVersion()) == 0) {
            throw new ApiException(ErrorCode.VERSION_CONFLICT);
        }

        tier.setName(name);

        eventPublisher.publishEvent(new TierRenamedEvent(
                roomId,
                request.baseVersion() + 1,
                senderParticipantId,
                request.clientEventId(),
                tier.getId(),
                name
        ));
    }

    // - 인자: 변경 요청
    // - 동작: 필수 필드와 이름 형식(공백 제거 후 1~100자) 검증, 정규화된 이름 반환
    private String validateRequest(TierRenameRequestDTO request) {
        if (request == null
                || request.baseVersion() == null
                || request.data() == null
                || request.data().tierId() == null
                || request.data().name() == null) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
        String name = request.data().name().strip();
        if (name.isEmpty() || name.length() > MAX_NAME_LENGTH) {
            throw new ApiException(ErrorCode.BAD_REQUEST, Map.of("field", "name"));
        }
        return name;
    }

    private void validateActive(Room room) {
        boolean expired = !room.getExpiresAt().isAfter(LocalDateTime.now(AppZone.KST));
        boolean closedStatus = "FINISHED".equals(room.getStatus())
                || "EXPIRED".equals(room.getStatus());
        if (expired || closedStatus) {
            throw new ApiException(ErrorCode.ROOM_CLOSED);
        }
    }
}
