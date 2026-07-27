package com.ssafy.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "try_on_jobs",
        indexes = {
                @Index(name = "ix_try_on_jobs_status_created_at", columnList = "status,created_at"),
                @Index(name = "ix_try_on_jobs_room_created_at", columnList = "room_id,created_at")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class TryOnJob {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "context_type", nullable = false, length = 20)
    private String contextType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    private Room room;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recommendation_id")
    private Recommendation recommendation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "avatar_id", nullable = false)
    private Avatar avatar;

    @Column(name = "board_version")
    private Long boardVersion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by_user_id")
    private User requestedByUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by_participant_id")
    private RoomParticipant requestedByParticipant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "retry_of_job_id")
    private TryOnJob retryOfJob;

    @Builder.Default
    @Column(name = "attempt_no", nullable = false)
    private Short attemptNo = 1;

    @Column(name = "top_tuck", length = 20)
    private String topTuck;

    @Column(name = "outer_closure", length = 20)
    private String outerClosure;

    @Column(name = "sleeves", length = 20)
    private String sleeves;

    @Column(name = "prompt", length = 200)
    private String prompt;

    @Builder.Default
    @Column(name = "status", nullable = false, length = 20)
    private String status = "QUEUED";

    @Column(name = "cache_key", length = 255)
    private String cacheKey;

    @Builder.Default
    @Column(name = "cache_hit", nullable = false)
    private boolean cacheHit = false;

    @Column(name = "result_image_url", length = 1000)
    private String resultImageUrl;

    @Column(name = "result_width")
    private Integer resultWidth;

    @Column(name = "result_height")
    private Integer resultHeight;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "fit_summary", columnDefinition = "json")
    private String fitSummary;

    @Column(name = "disclaimer", length = 500)
    private String disclaimer;

    @Column(name = "error_code", length = 50)
    private String errorCode;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    @Builder.Default
    @Column(name = "retryable", nullable = false)
    private boolean retryable = false;

    @Column(name = "model_version", length = 100)
    private String modelVersion;

    @Column(name = "prompt_version", length = 50)
    private String promptVersion;

    @Builder.Default
    @Column(name = "last_event_sequence", nullable = false)
    private Long lastEventSequence = 0L;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "processing_started_at")
    private LocalDateTime processingStartedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
