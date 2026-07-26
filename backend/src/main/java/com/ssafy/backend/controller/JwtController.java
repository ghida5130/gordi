package com.ssafy.backend.controller;

import com.ssafy.backend.common.response.ApiResponse;
import com.ssafy.backend.dto.JWTResponseDTO;
import com.ssafy.backend.dto.RefreshRequestDTO;
import com.ssafy.backend.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/jwt")
public class JwtController {

    private final JwtService jwtService;

    public JwtController(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @PostMapping(value = "/exchange", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ApiResponse<JWTResponseDTO> jwtExchangeApi(
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        return ApiResponse.success(jwtService.cookie2Header(request, response));
    }

    @PostMapping(value = "/refresh", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ApiResponse<JWTResponseDTO> jwtRefreshApi(
            @Validated @RequestBody RefreshRequestDTO dto
    ) {
        return ApiResponse.success(jwtService.refreshRotate(dto));
    }
}
