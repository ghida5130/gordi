package com.ssafy.backend.dto.avatar;

import com.ssafy.backend.domain.Avatar;

import java.util.function.UnaryOperator;

public record AvatarResponseDTO(
        Long avatarId, String gender, Long heightId, Long weightId,
        String bodyType, String imageUrl, boolean isDefault
) {
    public static AvatarResponseDTO from(Avatar avatar, UnaryOperator<String> imageUrlResolver) {
        return new AvatarResponseDTO(
                avatar.getId(), avatar.getGender(), avatar.getHeightId(),
                avatar.getWeightId(), avatar.getBodyType(),
                imageUrlResolver.apply(avatar.getImageUrl()),
                avatar.isDefaultAvatar());
    }
}
