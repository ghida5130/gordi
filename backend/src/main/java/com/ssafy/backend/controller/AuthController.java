package com.ssafy.backend.controller;

import com.ssafy.backend.common.response.ApiResponse;
import com.ssafy.backend.dto.auth.JWTResponseDTO;
import com.ssafy.backend.dto.users.SignUpResponseDTO;
import com.ssafy.backend.dto.users.UserRequestDTO;
import com.ssafy.backend.service.AuthService;
import com.ssafy.backend.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;   // 회원가입
    private final JwtService jwtService;      // 토큰 재발급/교환 (기존 서비스 그대로)

    public AuthController(AuthService authService, JwtService jwtService) {
        this.authService = authService;
        this.jwtService = jwtService;
    }

    // 회원가입  (기존 UserController.joinApi 이동)
    @PostMapping(value = "/signup", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<SignUpResponseDTO>> signup(
            @Validated(UserRequestDTO.addGroup.class) @RequestBody UserRequestDTO dto
    ) {
        Long id = authService.signup(dto);
        return ResponseEntity.status(201)
                .body(ApiResponse.success(new SignUpResponseDTO(id)));
    }

    // 토큰 재발급  (기존 JwtController.jwtRefreshApi 이동, /jwt/refresh -> /api/v1/auth/refresh)
    @PostMapping("/refresh")
    public ApiResponse<JWTResponseDTO> refresh(
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        return ApiResponse.success(jwtService.refreshRotate(request, response));
    }
}