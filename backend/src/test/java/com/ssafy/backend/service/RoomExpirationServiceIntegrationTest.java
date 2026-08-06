package com.ssafy.backend.service;

import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Recommendation;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.domain.RoomParticipant;
import com.ssafy.backend.domain.User;
import com.ssafy.backend.repository.RecommendationRepository;
import com.ssafy.backend.repository.RoomParticipantRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:room_expiration_integration;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "jwt.secret=room-expiration-integration-test-secret-key",
        "jwt.access-token-expiration=3600000",
        "jwt.refresh-token-expiration=604800000",
        "spring.security.oauth2.client.registration.kakao.client-id=test-client",
        "spring.security.oauth2.client.registration.kakao.client-secret=test-secret",
        "room.expiration-cleanup.enabled=false"
})
@Transactional
class RoomExpirationServiceIntegrationTest {

    @Autowired
    private RoomExpirationService roomExpirationService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RecommendationRepository recommendationRepository;
    @Autowired
    private RoomRepository roomRepository;
    @Autowired
    private RoomParticipantRepository roomParticipantRepository;
    @Autowired
    private EntityManager entityManager;

    private User host;
    private Recommendation recommendation;

    @BeforeEach
    void setUp() {
        host = userRepository.saveAndFlush(User.builder()
                .email(UUID.randomUUID() + "@example.com")
                .password("encoded-password")
                .nickname("host")
                .provider("LOCAL")
                .build());
        recommendation = recommendationRepository.saveAndFlush(
                Recommendation.builder()
                        .user(host)
                        .gender("MALE")
                        .category("TOP")
                        .status("READY")
                        .version(1L)
                        .build()
        );
    }

    @Test
    void dueRoomIsPersistedAsExpiredWithIncrementedVersion() {
        Room room = saveRoom("ABC234", "IN_PROGRESS", LocalDateTime.now(AppZone.KST).minusSeconds(1));

        boolean expired = roomExpirationService.expire(room.getId());
        entityManager.clear();

        Room saved = roomRepository.findById(room.getId()).orElseThrow();
        assertThat(expired).isTrue();
        assertThat(saved.getStatus()).isEqualTo("EXPIRED");
        assertThat(saved.getVersion()).isEqualTo(1L);
        assertThat(saved.getFinishedAt()).isNull();
    }

    @Test
    void dueRoomQueryExcludesFutureAndTerminalRooms() {
        Room dueWaiting = saveRoom(
                "DEF234",
                "WAITING",
                LocalDateTime.now(AppZone.KST).minusMinutes(1)
        );
        Room dueInProgress = saveRoom(
                "GHJ234",
                "IN_PROGRESS",
                LocalDateTime.now(AppZone.KST).minusSeconds(1)
        );
        saveRoom("KLM234", "IN_PROGRESS", LocalDateTime.now(AppZone.KST).plusMinutes(1));
        saveRoom("NPQ234", "EXPIRED", LocalDateTime.now(AppZone.KST).minusMinutes(1));

        List<Long> dueRoomIds = roomExpirationService.findDueRoomIds(10);

        assertThat(dueRoomIds).containsExactly(dueWaiting.getId(), dueInProgress.getId());
    }

    @Test
    void activeRoomQueryExcludesExpiredRoomBeforeSchedulerRuns() {
        Room room = saveRoom(
                "RST234",
                "IN_PROGRESS",
                LocalDateTime.now(AppZone.KST).minusSeconds(1)
        );
        roomParticipantRepository.saveAndFlush(RoomParticipant.builder()
                .room(room)
                .user(host)
                .nickname("host")
                .role("HOST")
                .build());

        List<RoomParticipant> activeRooms = roomParticipantRepository.findActiveByUserEmail(
                host.getEmail(),
                LocalDateTime.now(AppZone.KST)
        );

        assertThat(activeRooms).isEmpty();
    }

    private Room saveRoom(String roomCode, String status, LocalDateTime expiresAt) {
        return roomRepository.saveAndFlush(Room.builder()
                .roomCode(roomCode)
                .hostUser(host)
                .recommendation(recommendation)
                .recommendationVersion(1L)
                .maxParticipants(4)
                .idempotencyKey(UUID.randomUUID().toString())
                .status(status)
                .version(0L)
                .expiresAt(expiresAt)
                .build());
    }
}
