package com.ssafy.backend.dto.avatar;

import com.ssafy.backend.domain.Avatar;

public record AvatarResponseDTO(
        Long avatarId, String gender, Long heightId, Long weightId,
        String bodyType, String imageUrl, boolean isDefault
) {
    public static AvatarResponseDTO from(Avatar avatar) {
        return new AvatarResponseDTO(
                avatar.getId(), avatar.getGender(), avatar.getHeightId(),
                avatar.getWeightId(), avatar.getBodyType(), avatar.getImageUrl(),
                avatar.isDefaultAvatar());
    }
}
