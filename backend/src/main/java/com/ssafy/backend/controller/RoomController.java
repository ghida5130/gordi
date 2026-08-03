package com.ssafy.backend.controller;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.response.ApiResponse;
import com.ssafy.backend.dto.results.RoomResultResponseDTO;
import com.ssafy.backend.dto.room.RoomCreateRequestDTO;
import com.ssafy.backend.dto.room.RoomCreateResponseDTO;
import com.ssafy.backend.dto.room.RoomFinishRequestDTO;
import com.ssafy.backend.dto.room.RoomFinishResponseDTO;
import com.ssafy.backend.dto.room.RoomJoinRequestDTO;
import com.ssafy.backend.dto.room.RoomJoinResponseDTO;
import com.ssafy.backend.dto.room.RoomStatusResponseDTO;
import com.ssafy.backend.service.RoomFinishService;
import com.ssafy.backend.service.ResultService;
import com.ssafy.backend.service.RoomService;
import com.ssafy.backend.util.RoomPrincipalResolver;
import com.ssafy.backend.websocket.RoomPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;
    private final RoomFinishService roomFinishService;
    private final ResultService resultService;

    @PostMapping("/{roomCode}/finish")
    public ResponseEntity<ApiResponse<RoomFinishResponseDTO>> finish(
            @PathVariable String roomCode,
            @RequestBody @Valid RoomFinishRequestDTO request,
            Authentication authentication
    ) {
        RoomPrincipal principal = RoomPrincipalResolver.require(authentication);
        return ResponseEntity.ok(ApiResponse.success(
                roomFinishService.finish(roomCode, request, principal)
        ));
    }

    @GetMapping("/{roomCode}")
    public ResponseEntity<ApiResponse<RoomStatusResponseDTO>> readStatus(
            @PathVariable String roomCode,
            Authentication authentication
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                resolveRoomStatus(roomCode, authentication)
        ));
    }

    @GetMapping("/{roomCode}/result")
    public ResponseEntity<ApiResponse<RoomResultResponseDTO>> readResult(
            @PathVariable String roomCode,
            Authentication authentication
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                resolveRoomResult(roomCode, authentication)
        ));
    }

    private RoomStatusResponseDTO resolveRoomStatus(
            String roomCode,
            Authentication authentication
    ) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new ApiException(ErrorCode.UNAUTHORIZED);
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof RoomPrincipal roomPrincipal) {
            return roomService.readStatus(roomCode, roomPrincipal);
        }
        if (principal instanceof String email && !email.isBlank()) {
            return roomService.readStatusByAccessToken(roomCode, email);
        }
        throw new ApiException(ErrorCode.INVALID_TOKEN);
    }

    private RoomResultResponseDTO resolveRoomResult(
            String roomCode,
            Authentication authentication
    ) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new ApiException(ErrorCode.UNAUTHORIZED);
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof RoomPrincipal roomPrincipal) {
            return resultService.readRoomResult(roomCode, roomPrincipal);
        }
        if (principal instanceof String email && !email.isBlank()) {
            return resultService.readRoomResultByAccessToken(roomCode, email);
        }
        throw new ApiException(ErrorCode.INVALID_TOKEN);
    }

    /** 방 생성 (회원 전용). 호스트는 생성과 동시에 자동 join되어 roomToken을 받는다. */
    @PostMapping
    public ResponseEntity<ApiResponse<RoomCreateResponseDTO>> create(
            @RequestBody @Valid RoomCreateRequestDTO request,
            // TODO: Redis 기반 멱등성 처리 연결 예정 (중복 생성 방지)
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey, // 현재 require = false 이지만 서비스에서 필수 검증함
            Authentication authentication
    ) {
        RoomCreateResponseDTO response = roomService.create(
                authentication.getName(),
                request,
                idempotencyKey
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    /** 방 참가. 회원은 accessToken으로 재참여 가능, 게스트는 닉네임만 전송(재참여 불가). */
    @PostMapping("/{roomCode}/join")
    public ResponseEntity<ApiResponse<RoomJoinResponseDTO>> join(
            @PathVariable String roomCode,
            @RequestBody @Valid RoomJoinRequestDTO request,
            Authentication authentication
    ) {
        String email = resolveEmail(authentication);
        RoomJoinResponseDTO response = roomService.join(roomCode, request, email);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /** 게스트(미인증/익명)면 null, 회원이면 email 반환 */
    private String resolveEmail(Authentication authentication) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            return null;
        }
        if (authentication.getPrincipal() instanceof String email) {
            return email;
        }
        throw new ApiException(ErrorCode.INVALID_TOKEN);
    }
}
