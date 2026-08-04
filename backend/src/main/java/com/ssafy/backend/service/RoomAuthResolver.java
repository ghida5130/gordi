package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.config.enums.RoomRole;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.RoomParticipant;
import com.ssafy.backend.domain.User;
import com.ssafy.backend.repository.RoomParticipantRepository;
import com.ssafy.backend.repository.UserRepository;
import com.ssafy.backend.websocket.RoomPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Optional;

/**
 * 요청자를 회원 또는 방 참가자로 해석한다.
 * <p>
 * {@code JWTFilter} 가 토큰 종류에 따라 서로 다른 principal 을 넣는다.
 * <ul>
 *   <li>accessToken → 이메일 문자열. 회원으로 해석한다.</li>
 *   <li>roomToken → {@link RoomPrincipal}. 방 참가자로 해석하며 비회원 게스트일 수 있다.</li>
 * </ul>
 * 두 경로를 여기서 흡수해, 호출하는 Service 는 어떤 토큰으로 들어왔는지 알지 않아도 된다.
 */
@Component
@RequiredArgsConstructor
public class RoomAuthResolver {

    private final UserRepository userRepository;
    private final RoomParticipantRepository roomParticipantRepository;

    /** 회원으로 해석되지 않으면 UNAUTHORIZED. 비회원 게스트는 여기서 거절된다. */
    @Transactional(readOnly = true)
    public User requireMember(Authentication authentication) {
        return findMember(authentication)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
    }

    /**
     * 요청자가 회원이면 해당 회원, 아니면 빈 값.
     * roomToken 으로 들어왔더라도 그 참가자가 회원 계정을 가지고 있으면 회원으로 해석한다.
     */
    @Transactional(readOnly = true)
    public Optional<User> findMember(Authentication authentication) {
        if (!isAuthenticated(authentication)) {
            return Optional.empty();
        }

        if (authentication.getPrincipal() instanceof RoomPrincipal roomPrincipal) {
            return roomParticipantRepository.findById(roomPrincipal.participantId())
                    .map(RoomParticipant::getUser);
        }
        return userRepository.findByEmail(authentication.getName());
    }

    /**
     * 요청자의 해당 방 참가 정보.
     * roomToken 이면 토큰이 가리키는 참가자를, accessToken 이면 회원의 참가 이력을 찾는다.
     * 참가한 적 없거나 이미 퇴장했으면 FORBIDDEN.
     */
    @Transactional(readOnly = true)
    public RoomParticipant requireParticipant(Authentication authentication, Room room) {
        if (!isAuthenticated(authentication)) {
            throw new ApiException(ErrorCode.UNAUTHORIZED);
        }

        if (authentication.getPrincipal() instanceof RoomPrincipal roomPrincipal) {
            return resolveByRoomToken(roomPrincipal, room);
        }
        return resolveByMember(authentication, room);
    }

    /** HOST 전용 동작 검증 */
    public void requireHost(RoomParticipant participant) {
        if (!RoomRole.HOST.matches(participant.getRole())) {
            throw new ApiException(
                    ErrorCode.FORBIDDEN,
                    Map.of("requiredRole", RoomRole.HOST.name())
            );
        }
    }

    /* ==================== 해석 ==================== */

    // 다른 방의 roomToken 으로 이 방을 조작할 수 없다.
    private RoomParticipant resolveByRoomToken(RoomPrincipal principal, Room room) {
        if (!room.getId().equals(principal.roomId())) {
            throw new ApiException(
                    ErrorCode.FORBIDDEN,
                    "다른 방의 토큰으로는 접근할 수 없습니다.",
                    Map.of("roomCode", room.getRoomCode())
            );
        }

        return roomParticipantRepository
                .findByIdAndRoomIdAndLeftAtIsNull(principal.participantId(), room.getId())
                .orElseThrow(() -> new ApiException(
                        ErrorCode.FORBIDDEN,
                        Map.of("roomCode", room.getRoomCode())
                ));
    }

    private RoomParticipant resolveByMember(Authentication authentication, Room room) {
        User member = requireMember(authentication);

        RoomParticipant participant = roomParticipantRepository
                .findByRoomIdAndUserId(room.getId(), member.getId())
                .orElseThrow(() -> new ApiException(
                        ErrorCode.FORBIDDEN,
                        Map.of("roomCode", room.getRoomCode())
                ));

        if (participant.getLeftAt() != null) {
            throw new ApiException(ErrorCode.FORBIDDEN, Map.of("roomCode", room.getRoomCode()));
        }
        return participant;
    }

    private boolean isAuthenticated(Authentication authentication) {
        return authentication != null
                && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken);
    }
}
