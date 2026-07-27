package com.ssafy.backend.controller;

import com.ssafy.backend.common.response.ApiResponse;
import com.ssafy.backend.dto.UserRequestDTO;
import com.ssafy.backend.dto.UserResponseDTO;
import com.ssafy.backend.service.UserService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException; // 파일 시스템 예외가 아닌 Spring Security 예외로 변경
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    // 내 정보 조회
    @GetMapping("/me")
    public ApiResponse<UserResponseDTO> getMe() {
        return ApiResponse.success(userService.readUser());  // SecurityContext 에서 현재 사용자
    }

    // 닉네임 수정 (부분 수정 -> PATCH)
    @PatchMapping(value = "/me", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ApiResponse<Long> updateMe(
            @Validated(UserRequestDTO.updateGroup.class) @RequestBody UserRequestDTO dto
    ) throws AccessDeniedException {
        return ApiResponse.success(userService.updateUser(dto));
    }

    // 유저 존재 확인
    @PostMapping(value = "/exist", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<Boolean>> existUserApi(
            @Validated(UserRequestDTO.existGroup.class) @RequestBody UserRequestDTO dto
    ) {
        return ResponseEntity.ok(ApiResponse.success(userService.existUser(dto)));
    }

    // 유저 정보 조회
    @GetMapping
    public ApiResponse<UserResponseDTO> userMeApi() {
        return ApiResponse.success(userService.readUser());
    }

    // 유저 수정
    @PutMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<Long>> updateUserApi(
            @Validated(UserRequestDTO.updateGroup.class) @RequestBody UserRequestDTO dto
    ) throws AccessDeniedException {
        return ResponseEntity.ok(ApiResponse.success(userService.updateUser(dto))); // userId 반환
    }

    // 유저 제거
    @DeleteMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<Boolean>> deleteUserApi(
            @Validated(UserRequestDTO.deleteGroup.class) @RequestBody UserRequestDTO dto
    ) throws AccessDeniedException {
        userService.deleteUser(dto);
        return ResponseEntity.ok(ApiResponse.success(true));
    }
}
