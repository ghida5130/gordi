package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.config.enums.RoomRole;
import com.ssafy.backend.domain.RoomParticipant;
import com.ssafy.backend.repository.RoomParticipantRepository;
import com.ssafy.backend.websocket.RoomPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RoomAccessValidator {

    private final RoomParticipantRepository roomParticipantRepository;

    public RoomParticipant requireParticipant(
            Long requestedRoomId,
            RoomPrincipal principal
    ) {
        if (principal == null) {
            throw new ApiException(ErrorCode.UNAUTHORIZED);
        }

        if (!Objects.equals(requestedRoomId, principal.roomId())) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }

        return roomParticipantRepository
                .findByIdAndRoomIdAndLeftAtIsNull(
                        principal.participantId(),
                        requestedRoomId
                )
                .orElseThrow(() -> new ApiException(ErrorCode.FORBIDDEN));
    }

    public RoomParticipant requireParticipant(
            Long requestedRoomId,
            String email
    ) {
        if (email == null || email.isBlank()) {
            throw new ApiException(ErrorCode.UNAUTHORIZED);
        }

        return roomParticipantRepository
                .findByRoomIdAndUserEmailAndLeftAtIsNull(requestedRoomId, email)
                .orElseThrow(() -> new ApiException(ErrorCode.FORBIDDEN));
    }

    /** 방 결과 조회를 위해 퇴장 여부와 무관하게 참여 이력을 검증한다. */
    public RoomParticipant requireParticipantHistory(
            Long requestedRoomId,
            RoomPrincipal principal
    ) {
        if (principal == null) {
            throw new ApiException(ErrorCode.UNAUTHORIZED);
        }

        if (!Objects.equals(requestedRoomId, principal.roomId())) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }

        return roomParticipantRepository
                .findByIdAndRoomId(principal.participantId(), requestedRoomId)
                .orElseThrow(() -> new ApiException(ErrorCode.FORBIDDEN));
    }

    public RoomParticipant requireParticipantHistory(
            Long requestedRoomId,
            String email
    ) {
        if (email == null || email.isBlank()) {
            throw new ApiException(ErrorCode.UNAUTHORIZED);
        }

        return roomParticipantRepository
                .findByRoomIdAndUserEmail(requestedRoomId, email)
                .orElseThrow(() -> new ApiException(ErrorCode.FORBIDDEN));
    }

    /** HOST 전용 동작 검증 */
    public void requireHost(RoomParticipant participant) {
        if (!RoomRole.HOST.matches(participant.getRole())) {
            throw new ApiException(
                    ErrorCode.FORBIDDEN,
                    Map.of("requiredRole", RoomRole.HOST.name())
            );
        }
    }
}
