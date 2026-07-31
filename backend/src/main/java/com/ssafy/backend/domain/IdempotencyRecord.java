package com.ssafy.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

// Idempotency-Key 처리 기록 (동일 키 재요청 시 같은 결과를 반환하기 위한 저장소)
@Entity
@Table(
        name = "idempotency_records",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_idempotency_user_key",
                columnNames = {"user_id", "idempotency_key"}
        ),
        indexes = @Index(name = "idx_idempotency_created_at", columnList = "created_at")
)
@Getter
@Setter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class IdempotencyRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "idempotency_key", nullable = false, length = 128)
    private String idempotencyKey;

    // 같은 키가 다른 엔드포인트에 쓰이는 것을 구분
    @Column(name = "endpoint", nullable = false, length = 200)
    private String endpoint;

    // 같은 키로 다른 본문이 들어오면 IDEMPOTENCY_KEY_REUSED
    @Column(name = "request_hash", nullable = false, length = 64)
    private String requestHash;

    @Column(name = "recommendation_id", nullable = false)
    private Long recommendationId;

    @Column(name = "recommendation_version", nullable = false)
    private Long recommendationVersion;

    // 재요청 시 그대로 돌려줄 응답 본문
    @Column(name = "response_body", nullable = false, columnDefinition = "TEXT")
    private String responseBody;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
