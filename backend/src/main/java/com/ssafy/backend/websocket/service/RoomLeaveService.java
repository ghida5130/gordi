package com.ssafy.backend.websocket.service;

import com.ssafy.backend.common.aop.BusinessOperation;
import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.RoomParticipant;
import com.ssafy.backend.repository.RoomParticipantRepository;
import com.ssafy.backend.websocket.event.ParticipantLeaveReason;
import com.ssafy.backend.websocket.event.ParticipantLeftEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** 명시적 퇴장과 연결 유실 퇴장을 하나의 멱등 경로로 처리한다. */
@Service
@RequiredArgsConstructor
public class RoomLeaveService {

    private final RoomParticipantRepository roomParticipantRepository;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * 활성 참가자의 leftAt을 조건부 갱신하고 PARTICIPANT_LEFT 도메인 이벤트를 발행한다.
     * 이미 퇴장한 참가자라면 false를 반환하고 이벤트를 중복 발행하지 않는다.
     */
    @BusinessOperation(value = "room.leave", slowThresholdMs = 1_000)
    @Transactional
    public boolean leave(
            Long roomId,
            Long participantId,
            String clientEventId,
            ParticipantLeaveReason reason
    ) {
        validateRequest(roomId, participantId, clientEventId, reason);

        RoomParticipant participant = roomParticipantRepository
                .findByIdAndRoomIdAndLeftAtIsNull(participantId, roomId)
                .orElse(null);
        if (participant == null) {
            return false;
        }

        Long roomVersion = participant.getRoom().getVersion();
        int updated = roomParticipantRepository.markLeftIfActive(
                participantId,
                roomId,
                LocalDateTime.now(AppZone.KST)
        );
        if (updated == 0) {
            return false;
        }

        eventPublisher.publishEvent(new ParticipantLeftEvent(
                roomId,
                roomVersion,
                participantId,
                clientEventId,
                reason
        ));
        return true;
    }

    private void validateRequest(
            Long roomId,
            Long participantId,
            String clientEventId,
            ParticipantLeaveReason reason
    ) {
        if (roomId == null || participantId == null || reason == null) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
        if (reason == ParticipantLeaveReason.USER_REQUEST
                && (clientEventId == null || clientEventId.isBlank())) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
    }
}
