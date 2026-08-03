package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.config.enums.RoomRole;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.RoomParticipant;
import com.ssafy.backend.domain.User;
import com.ssafy.backend.repository.RoomParticipantRepository;
import com.ssafy.backend.repository.UserRepository;
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
 * <b>현재 제약</b>: roomToken 은 아직 HTTP 인증 경로에 연결되어 있지 않다.
 * {@code JWTFilter} 는 accessToken 만 SecurityContext 에 넣고,
 * {@code RoomTokenProvider} 는 STOMP CONNECT 인터셉터에서만 사용된다.
 * 그래서 방 참가자 해석은 accessToken 으로 인증된 회원의 참가 이력을 조회하는 방식으로만 동작하고,
 * 게스트(비회원) 참가자는 UNAUTHORIZED 로 거절된다.
 * <p>
 * roomToken HTTP 인증이 도입되면 이 클래스 안에서 SecurityContext 의 RoomPrincipal 을 읽도록
 * 바꾸면 되고, 호출하는 Service 는 수정하지 않는다.
 */
@Component
@RequiredArgsConstructor
public class RoomAuthResolver {

    private final UserRepository userRepository;
    private final RoomParticipantRepository roomParticipantRepository;

    /** accessToken 으로 인증된 회원. 비회원이면 UNAUTHORIZED. */
    @Transactional(readOnly = true)
    public User requireMember(Authentication authentication) {
        return findMember(authentication)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
    }

    /** 인증 정보가 회원이면 해당 회원, 게스트/미인증이면 빈 값. */
    @Transactional(readOnly = true)
    public Optional<User> findMember(Authentication authentication) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            return Optional.empty();
        }
        return userRepository.findByEmail(authentication.getName());
    }

    /**
     * 요청자의 해당 방 참가 정보. 참가한 적 없거나 이미 퇴장했으면 FORBIDDEN.
     * 게스트 참가자는 roomToken HTTP 인증이 없어 아직 해석할 수 없다.
     */
    @Transactional(readOnly = true)
    public RoomParticipant requireParticipant(Authentication authentication, Room room) {
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

    /** HOST 전용 동작 검증 */
    public void requireHost(RoomParticipant participant) {
        if (!RoomRole.HOST.matches(participant.getRole())) {
            throw new ApiException(
                    ErrorCode.FORBIDDEN,
                    Map.of("requiredRole", RoomRole.HOST.name())
            );
        }
    }
}
