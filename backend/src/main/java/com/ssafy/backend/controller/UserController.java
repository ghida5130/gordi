package com.ssafy.backend.controller;

import com.ssafy.backend.common.response.ApiResponse;
import com.ssafy.backend.dto.avatar.AvatarResponseDTO;
import com.ssafy.backend.dto.avatar.AvatarSelectRequestDTO;
import com.ssafy.backend.dto.avatar.MyAvatarResponseDTO;
import com.ssafy.backend.dto.avatar.UserAvatarResponseDTO;
import com.ssafy.backend.dto.results.MyResultListResponseDTO;
import com.ssafy.backend.dto.room.MyActiveRoomResponseDTO;
import com.ssafy.backend.dto.users.NicknameRequestDTO;
import com.ssafy.backend.dto.users.UserRequestDTO;
import com.ssafy.backend.dto.users.UserResponseDTO;
import com.ssafy.backend.service.AvatarService;
import com.ssafy.backend.service.ResultService;
import com.ssafy.backend.service.RoomService;
import com.ssafy.backend.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;
    private final AvatarService avatarService;
    private final ResultService resultService;
    private final RoomService roomService;

    public UserController(UserService userService, AvatarService avatarService, ResultService resultService, RoomService roomService) {
        this.userService = userService;
        this.avatarService = avatarService;
        this.resultService = resultService;
        this.roomService = roomService;
    }

    // 내 정보 조회
    @GetMapping("/me")
    public ApiResponse<UserResponseDTO> getMe() {
        return ApiResponse.success(userService.readUser());  // SecurityContext 에서 현재 사용자
    }

    // 닉네임 수정 (부분 수정 -> PATCH)
    @PatchMapping(value = "/me", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Void> updateMe(
            @Valid @RequestBody NicknameRequestDTO dto
    ) {
        userService.updateNickname(dto.nickname());
        return ResponseEntity.noContent().build();
    }

    // 유저 존재 확인
    @PostMapping(value = "/exist", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<Boolean>> existUserApi(
            @Validated(UserRequestDTO.existGroup.class) @RequestBody UserRequestDTO dto
    ) {
        return ResponseEntity.ok(ApiResponse.success(userService.existUser(dto)));
    }

    /** 나의 아바타 조회 */
    @GetMapping("/me/avatar")
    public ApiResponse<MyAvatarResponseDTO> readMyAvatar(Authentication authentication) {
        return ApiResponse.success(avatarService.readMyAvatar(authentication.getName()));
    }

    /** 아바타 프리셋 선택·변경 */
    @PutMapping(value = "/me/avatar", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ApiResponse<UserAvatarResponseDTO> selectAvatar(
            @RequestBody @Valid AvatarSelectRequestDTO request,
            Authentication authentication
    ) {
        return ApiResponse.success(
                avatarService.selectAvatar(
                        authentication.getName(),
                        request.avatarId(),
                        request.height(),
                        request.weight()));
    }

    @GetMapping("/me/results")
    public ApiResponse<MyResultListResponseDTO> readMyResults(Authentication authentication) {
        return ApiResponse.success(resultService.readMyResults(authentication.getName()));
    }

    @GetMapping("/me/active-room")
    public ApiResponse<MyActiveRoomResponseDTO> readMyActiveRoom(Authentication authentication) {
        return ApiResponse.success(roomService.readMyActiveRoom(authentication.getName()));
    }
}
