package com.ssafy.backend.controller;

import com.ssafy.backend.common.response.ApiResponse;
import com.ssafy.backend.dto.tryon.OutfitSnapshotConfirmRequestDTO;
import com.ssafy.backend.dto.tryon.OutfitSnapshotResponseDTO;
import com.ssafy.backend.service.TryOnService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 방 확정 착장 스냅샷.
 * 방 생성·참가와 소유 주체가 다르므로 {@link RoomController} 와 분리해 같은 기본 경로에 등록한다.
 */
@RestController
@RequestMapping("/api/v1/rooms")
@RequiredArgsConstructor
public class OutfitSnapshotController {

    private final TryOnService tryOnService;

    /** 성공한 착장 이미지를 방 확정 스냅샷으로 지정 (HOST 전용) */
    @PutMapping("/{roomCode}/outfit-snapshot")
    public ResponseEntity<ApiResponse<OutfitSnapshotResponseDTO>> confirm(
            @PathVariable String roomCode,
            @RequestBody @Valid OutfitSnapshotConfirmRequestDTO request,
            Authentication authentication
    ) {
        OutfitSnapshotResponseDTO response =
                tryOnService.confirmSnapshot(roomCode, request, authentication);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
