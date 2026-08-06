package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.dto.room.VoiceTokenResponseDTO;
import com.ssafy.backend.repository.RoomParticipantRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.util.LivekitTokenProvider;
import com.ssafy.backend.websocket.RoomPrincipal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Map;

/**
 * 음성 통화(LiveKit) 토큰 발급.
 * <p>
 * ROOM_STARTED(IN_PROGRESS) 이후 각 참가자가 roomToken 인증으로 호출한다.
 * 최초 발급과 재연결 시 재발급 모두 이 서비스 하나로 처리한다.
 */
@Service
public class VoiceTokenService {

    private static final String IN_PROGRESS = "IN_PROGRESS";

    private final RoomRepository roomRepository;
    private final RoomParticipantRepository roomParticipantRepository;
    private final LivekitTokenProvider livekitTokenProvider;
    private final String serverUrl;
    private final String roomNamePrefix;

    public VoiceTokenService(
            RoomRepository roomRepository,
            RoomParticipantRepository roomParticipantRepository,
            LivekitTokenProvider livekitTokenProvider,
            @Value("${livekit.server-url}") String serverUrl,
            @Value("${livekit.room-name-prefix:gordi-room-}") String roomNamePrefix
    ) {
        this.roomRepository = roomRepository;
        this.roomParticipantRepository = roomParticipantRepository;
        this.livekitTokenProvider = livekitTokenProvider;
        this.serverUrl = serverUrl;
        this.roomNamePrefix = roomNamePrefix;
    }

    // - 인자: path의 roomCode, roomToken에서 복원된 참가자 Principal
    // - 동작: 방 존재/소속 → 방 상태(IN_PROGRESS) → 참가자 활성 검증 후 LiveKit 토큰 발급
    @Transactional(readOnly = true)
    public VoiceTokenResponseDTO issue(String rawRoomCode, RoomPrincipal principal) {
        Room room = roomRepository.findByRoomCode(normalizeRoomCode(rawRoomCode))
                .orElseThrow(() -> new ApiException(ErrorCode.ROOM_NOT_FOUND));

        // 다른 방의 roomToken으로 이 방의 토큰을 받는 것을 차단
        if (!room.getId().equals(principal.roomId())) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }
        validateVoiceIssuable(room);

        // 퇴장한 참가자는 재발급 불가 (join으로 재참여 후 다시 발급)
        roomParticipantRepository
                .findByIdAndRoomIdAndLeftAtIsNull(principal.participantId(), room.getId())
                .orElseThrow(() -> new ApiException(ErrorCode.FORBIDDEN));

        LivekitTokenProvider.IssuedToken issued = livekitTokenProvider.createParticipantToken(
                principal.participantId(),
                principal.nickname(),
                roomNamePrefix + room.getId(),
                room.getExpiresAt()
        );
        return new VoiceTokenResponseDTO(serverUrl, issued.token(), issued.expiresAt());
    }

    private void validateVoiceIssuable(Room room) {
        boolean expired = !room.getExpiresAt().isAfter(LocalDateTime.now(AppZone.KST));
        boolean closedStatus = "FINISHED".equals(room.getStatus())
                || "EXPIRED".equals(room.getStatus());
        if (expired || closedStatus) {
            throw new ApiException(ErrorCode.ROOM_CLOSED);
        }
        if (!IN_PROGRESS.equals(room.getStatus())) {
            throw new ApiException(
                    ErrorCode.CONFLICT,
                    "진행 중(IN_PROGRESS)인 방에서만 음성 토큰을 발급할 수 있습니다.",
                    Map.of("status", room.getStatus())
            );
        }
    }

    private String normalizeRoomCode(String rawRoomCode) {
        if (rawRoomCode == null) {
            throw new ApiException(ErrorCode.ROOM_NOT_FOUND);
        }
        return rawRoomCode.strip().toUpperCase(Locale.ROOT);
    }
}
