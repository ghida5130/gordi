package com.ssafy.backend.dto.avatar;

public record MyAvatarResponseDTO (
        AvatarResponseDTO avatar,
        Integer height,
        Integer weight
){ }
