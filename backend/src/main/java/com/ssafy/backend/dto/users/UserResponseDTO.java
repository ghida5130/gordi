package com.ssafy.backend.dto.users;

import com.ssafy.backend.domain.User;

import java.util.function.UnaryOperator;

public record UserResponseDTO (
        Long userId,
        String email,
        String nickname,
        AvatarSummary avatar
) {
    public record AvatarSummary(Long avatarId, String imageUrl) {}

    public static UserResponseDTO from(User user, UnaryOperator<String> imageUrlResolver) {
        AvatarSummary avatar = (user.getAvatar() == null) ? null
                : new AvatarSummary(user.getAvatar().getId(),
                        imageUrlResolver.apply(user.getAvatar().getImageUrl()));

        return new UserResponseDTO(
                user.getId(), user.getEmail(), user.getNickname(), avatar);
    }
}
