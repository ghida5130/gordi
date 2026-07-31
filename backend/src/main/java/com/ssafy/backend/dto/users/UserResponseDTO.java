package com.ssafy.backend.dto.users;

import com.ssafy.backend.domain.User;

public record UserResponseDTO (
        Long userId,
        String email,
        String nickname,
        AvatarSummary avatar
) {
    public record AvatarSummary(Long avatarId, String imageUrl) {}

    public static UserResponseDTO from(User user) {
        AvatarSummary avatar = (user.getAvatar() == null) ? null
                : new AvatarSummary(user.getAvatar().getId(), user.getAvatar().getImageUrl());

        return new UserResponseDTO(
                user.getId(), user.getEmail(), user.getNickname(), avatar);
    }
}
