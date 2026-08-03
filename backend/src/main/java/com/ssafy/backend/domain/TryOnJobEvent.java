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
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * 외부 생성 서비스가 보낸 착장 Job 콜백 이벤트 수신 기록.
 * <p>
 * 같은 이벤트가 재전송돼도 결과가 달라지지 않도록 {@code (try_on_job_id, event_id)} 유니크 제약으로
 * 중복을 막는다. 정상 재전송은 서비스에서 조회로 먼저 걸러지고, 동시 전송 경합만 이 제약이 최종적으로 막는다.
 */
@Entity
@Table(
        name = "try_on_job_events",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_try_on_job_events_job_event",
                columnNames = {"try_on_job_id", "event_id"}
        )
)
@Getter
@Setter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class TryOnJobEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "try_on_job_id", nullable = false)
    private TryOnJob tryOnJob;

    // 발신 측이 부여한 이벤트 식별자 (중복 판정 키)
    @Column(name = "event_id", nullable = false, length = 64)
    private String eventId;

    // 발신 측 순번. 낮은 순번이 늦게 도착하면 무시한다. (SEQUENCE 예약어를 피해 컬럼명을 분리)
    @Column(name = "event_sequence", nullable = false)
    private Long sequence;

    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    @CreationTimestamp
    @Column(name = "received_at", nullable = false, updatable = false)
    private LocalDateTime receivedAt;
}
