package com.ssafy.backend.controller;

import com.ssafy.backend.common.response.ApiResponse;
import com.ssafy.backend.dto.avatar.AvatarTemplateListResponseDTO;
import com.ssafy.backend.dto.avatar.AvatarTemplateRequestDTO;
import com.ssafy.backend.service.AvatarService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/avatars")
@RequiredArgsConstructor
public class AvatarController {

    private final AvatarService avatarService;

    /** 아바타 후보 목록 조회 */
    @PostMapping(value = "/templates", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ApiResponse<AvatarTemplateListResponseDTO> readTemplates(
            @RequestBody @Valid AvatarTemplateRequestDTO request
    ) {
        return ApiResponse.success(avatarService.readTemplates(request));
    }
}