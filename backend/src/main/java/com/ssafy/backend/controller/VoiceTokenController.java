package com.ssafy.backend.controller;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.response.ApiResponse;
import com.ssafy.backend.dto.room.VoiceTokenResponseDTO;
import com.ssafy.backend.service.VoiceTokenService;
import com.ssafy.backend.websocket.RoomPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/rooms")
@RequiredArgsConstructor
public class VoiceTokenController {

    private final VoiceTokenService voiceTokenService;

    /**
     * LiveKit 음성 토큰 발급. ROOM_STARTED 수신 후 각 참가자가 호출한다.
     * roomToken(Bearer) 전용 — JWTFilter가 RoomPrincipal로 인증한 요청만 처리.
     * 재연결 시에도 같은 API로 재발급받는다.
     */
    @PostMapping("/{roomCode}/voice/token")
    public ResponseEntity<ApiResponse<VoiceTokenResponseDTO>> issue(
            @PathVariable String roomCode,
            Authentication authentication
    ) {
        if (authentication == null
                || !(authentication.getPrincipal() instanceof RoomPrincipal principal)) {
            // accessToken 등 다른 토큰으로 호출한 경우
            throw new ApiException(ErrorCode.INVALID_TOKEN, "roomToken으로만 호출할 수 있습니다.");
        }
        VoiceTokenResponseDTO response = voiceTokenService.issue(roomCode, principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }
}
