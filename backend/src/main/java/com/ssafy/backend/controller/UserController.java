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
@RequestMapping("/user")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    // 유저 존재 확인
    @PostMapping(value = "/exist", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<Boolean>> existUserApi(
            @Validated(UserRequestDTO.existGroup.class) @RequestBody UserRequestDTO dto
    ) {
        return ResponseEntity.ok(ApiResponse.success(userService.existUser(dto)));
    }

    // 회원가입
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<Map<String, Long>>> joinApi(
            @Validated(UserRequestDTO.addGroup.class) @RequestBody UserRequestDTO dto
    ) {
        Long id = userService.addUser(dto);
        Map<String, Long> responseBody = Collections.singletonMap("userId", id);
        return ResponseEntity.status(201).body(ApiResponse.success(responseBody));
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
