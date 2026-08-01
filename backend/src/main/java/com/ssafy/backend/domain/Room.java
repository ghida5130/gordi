package com.ssafy.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "rooms",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_rooms_room_code", columnNames = "room_code"),
                @UniqueConstraint(
                        name = "uk_rooms_host_idempotency_key",
                        columnNames = {"host_user_id", "idempotency_key"}
                )
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "room_code", nullable = false, length = 6)
    private String roomCode;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "host_user_id", nullable = false)
    private User hostUser;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recommendation_id", nullable = false)
    private Recommendation recommendation;

    @Column(name = "recommendation_version", nullable = false)
    private Long recommendationVersion;

    @Column(name = "max_participants", nullable = false)
    private Integer maxParticipants;

    /**
     * 방의 확정 착장 스냅샷. HOST 가 성공한 착장 Job 하나를 지정하며 재지정할 수 있다.
     * 확정 시 Room 이 갱신되므로 {@link #version} 이 함께 증가한다.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "confirmed_try_on_job_id")
    private TryOnJob confirmedTryOnJob;

    @Column(name = "idempotency_key", nullable = false, length = 36)
    private String idempotencyKey;

    @Builder.Default
    @Column(name = "status", nullable = false, length = 50)
    private String status = "WAITING"; // WAITING, IN_PROGRESS, FINISHED, CLOSED

    @Version
    @Builder.Default
    @Column(name = "version", nullable = false)
    private Long version = 0L;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;
}
