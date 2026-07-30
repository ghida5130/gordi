package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.domain.Avatar;
import com.ssafy.backend.domain.User;
import com.ssafy.backend.dto.avatar.AvatarResponseDTO;
import com.ssafy.backend.dto.avatar.AvatarTemplateListResponseDTO;
import com.ssafy.backend.dto.avatar.AvatarTemplateRequestDTO;
import com.ssafy.backend.dto.avatar.UserAvatarResponseDTO;
import com.ssafy.backend.repository.AvatarRepository;
import com.ssafy.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AvatarService {

    private static final long NEIGHBOR_RANGE = 1L;

    /** 성별만 입력된 경우 반환할 아바타 id. 수동 삽입한 프리셋의 실제 id와 맞춰야 함. */
    private static final Map<String, Long> GENDER_DEFAULT_AVATAR_ID = Map.of(
            "MALE", 38L,
            "FEMALE", 113L
    );

    private final AvatarRepository avatarRepository;
    private final UserRepository userRepository;

    /** 나의 아바타 조회 */
    @Transactional(readOnly = true)
    public AvatarResponseDTO readMyAvatar(String email) {
        Avatar avatar = findUser(email).getAvatar();
        if (avatar == null) {
            throw new ApiException(ErrorCode.AVATAR_NOT_FOUND, "선택된 아바타가 없습니다.");
        }
        return AvatarResponseDTO.from(avatar);
    }

    /** 아바타 프리셋 선택·변경 */
    @Transactional
    public UserAvatarResponseDTO selectAvatar(String email, Long avatarId) {
        User user = findUser(email);
        Avatar avatar = avatarRepository.findById(avatarId)
                .orElseThrow(() -> new ApiException(
                        ErrorCode.AVATAR_NOT_FOUND, Map.of("avatarId", avatarId)));
        user.setAvatar(avatar);   // 더티 체킹으로 flush
        return new UserAvatarResponseDTO(user.getId(), avatar.getId());
    }

    /** 아바타 후보 목록 조회. heightId/weightId 0 = 미입력 */
    @Transactional(readOnly = true)
    public AvatarTemplateListResponseDTO readTemplates(AvatarTemplateRequestDTO request) {
        String gender = request.gender().toUpperCase();
        long heightId = request.heightId();
        long weightId = request.weightId();

        // 성별만 입력 → 하드코딩된 아바타 반환
        if (heightId == 0L && weightId == 0L) {
            Long avatarId = GENDER_DEFAULT_AVATAR_ID.get(gender);
            if (avatarId == null) {
                throw new ApiException(ErrorCode.BAD_REQUEST,
                        "지원하지 않는 성별입니다.", Map.of("gender", gender));
            }
            Avatar avatar = avatarRepository.findById(avatarId)
                    .orElseThrow(() -> new ApiException(ErrorCode.AVATAR_NOT_FOUND,
                            Map.of("avatarId", avatarId)));
            return new AvatarTemplateListResponseDTO(
                    List.of(AvatarResponseDTO.from(avatar)));
        }

        // 키만 입력 → 해당 키 구간의 기본 프리셋
        if (weightId == 0L) {
            Avatar fallback = avatarRepository
                    .findFirstByGenderAndHeightIdAndDefaultAvatarTrue(gender, heightId)
                    .orElseThrow(() -> new ApiException(ErrorCode.AVATAR_NOT_FOUND,
                            Map.of("gender", gender, "heightId", heightId)));
            return new AvatarTemplateListResponseDTO(
                    List.of(AvatarResponseDTO.from(fallback)));
        }

        // 몸무게만 입력 → 정의되지 않은 조합
        if (heightId == 0L) {
            throw new ApiException(ErrorCode.BAD_REQUEST,
                    "키 없이 몸무게만 지정할 수 없습니다.", Map.of("weightId", weightId));
        }

        // 둘 다 입력 → 해당 구간의 체형별 아바타
        List<Avatar> candidates = avatarRepository
                .findByGenderAndHeightIdAndWeightIdOrderByBodyTypeAsc(
                        gender, heightId, weightId);

        if (candidates.isEmpty()) {
            throw new ApiException(ErrorCode.AVATAR_NOT_FOUND,
                    Map.of("gender", gender, "heightId", heightId, "weightId", weightId));
        }

        return new AvatarTemplateListResponseDTO(
                candidates.stream().map(AvatarResponseDTO::from).toList());
    }

    private User findUser(String email) {
        if (email == null || email.isBlank()) {
            throw new ApiException(ErrorCode.UNAUTHORIZED);
        }
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
    }
}