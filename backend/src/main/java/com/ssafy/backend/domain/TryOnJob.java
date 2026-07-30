package com.ssafy.backend.domain;

import com.ssafy.backend.config.enums.TryOnContextType;
import com.ssafy.backend.config.enums.TryOnJobStatus;
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

import java.time.LocalDateTime;

/**
 * 착장 이미지 생성 Job.
 * <p>
 * 등록 시점에는 QUEUED 로 저장되고, 외부 생성 서비스의 처리 결과가 도착하면
 * SUCCEEDED(결과 컬럼 채움) 또는 FAILED(실패 컬럼 채움)로 전이한다.
 * 실패는 오류 응답이 아니라 조회 API의 status=FAILED 로 노출되므로 실패 원인도 함께 보관한다.
 */
@Entity
@Table(
        name = "try_on_jobs",
        indexes = {
                // 캐시 재사용 판정 (동일 요청 해시의 성공 Job 조회)
                @Index(name = "ix_try_on_jobs_request_hash", columnList = "request_hash, status"),
                // 사용자별 생성 한도 집계
                @Index(name = "ix_try_on_jobs_owner_user_created", columnList = "owner_user_id, created_at")
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

    /* ---------- 생성 컨텍스트 ---------- */

    @Builder.Default
    @Column(
            name = "context_type",
            nullable = false,
            length = 50,
            columnDefinition = "varchar(50) not null default 'SOLO'"
    )
    private String contextType = TryOnContextType.SOLO.name();

    // ROOM 컨텍스트에서만 설정된다.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    private Room room;

    // 요청 시점의 방 보드 버전 (ROOM 컨텍스트에서만 설정된다)
    @Column(name = "board_version")
    private Long boardVersion;

    /**
     * 요청한 회원. 게스트 참가자가 요청한 ROOM Job 은 null 이므로
     * 소유자 판정에는 {@link #ownerParticipant} 를 함께 확인해야 한다.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id")
    private User ownerUser;

    // 요청한 방 참가자 (ROOM 컨텍스트에서만 설정된다)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_participant_id")
    private RoomParticipant ownerParticipant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "avatar_id", nullable = false)
    private Avatar avatar;

    /* ---------- 착용 옵션 ---------- */

    @Column(name = "top_tuck", length = 50)
    private String topTuck;

    @Column(name = "outer_closure", length = 50)
    private String outerClosure;

    @Column(name = "sleeves", length = 50)
    private String sleeves;

    @Column(name = "prompt", columnDefinition = "TEXT")
    private String prompt;

    /* ---------- 상태 ---------- */

    @Builder.Default
    @Column(
            name = "status",
            nullable = false,
            length = 50,
            columnDefinition = "varchar(50) not null default 'QUEUED'"
    )
    private String status = TryOnJobStatus.QUEUED.name();

    // 동일 요청 재사용 여부. 캐시 재사용으로 만들어진 Job 이면 true.
    @Builder.Default
    @Column(
            name = "cache_hit",
            nullable = false,
            columnDefinition = "boolean not null default false"
    )
    private boolean cacheHit = false;

    // (아바타 + 상품 구성 + 착용 옵션 + 프롬프트) 해시. 캐시 재사용 판정 키.
    @Column(name = "request_hash", length = 64)
    private String requestHash;

    // 재시도로 생성된 Job 이면 원본 Job 을 가리킨다.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "retry_of_job_id")
    private TryOnJob retryOfJob;

    /* ---------- 결과 (SUCCEEDED) ---------- */

    @Column(name = "result_image_url", length = 2048)
    private String resultImageUrl;

    @Column(name = "result_width")
    private Integer resultWidth;

    @Column(name = "result_height")
    private Integer resultHeight;

    // 핏 설명 문구 목록의 JSON 배열 표현. 표현 계층에서 List<String> 으로 변환한다.
    @Column(name = "fit_summary", columnDefinition = "TEXT")
    private String fitSummaryJson;

    @Column(name = "disclaimer", length = 500)
    private String disclaimer;

    /* ---------- 실패 (FAILED) ---------- */

    @Column(name = "error_code", length = 100)
    private String errorCode;

    @Column(name = "error_message", length = 500)
    private String errorMessage;

    // 재시도 허용 여부. 재시도 API 는 이 값이 true 인 FAILED Job 만 허용한다.
    @Column(name = "error_retryable")
    private Boolean errorRetryable;

    /* ---------- 생성 메타 ---------- */

    @Column(name = "model_version", length = 100)
    private String modelVersion;

    @Column(name = "prompt_version", length = 50)
    private String promptVersion;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    /* ---------- 상태 조회 ---------- */

    public TryOnJobStatus resolveStatus() {
        return TryOnJobStatus.valueOf(status);
    }

    public TryOnContextType resolveContextType() {
        return TryOnContextType.valueOf(contextType);
    }

    public boolean isSucceeded() {
        return TryOnJobStatus.SUCCEEDED.matches(status);
    }

    public boolean isFailed() {
        return TryOnJobStatus.FAILED.matches(status);
    }

    // 재시도 가능한 실패 Job 인지 (재시도 API 의 허용 조건)
    public boolean isRetryable() {
        return isFailed() && Boolean.TRUE.equals(errorRetryable);
    }

    /* ---------- 상태 전이 ---------- */

    // 생성 성공 결과 반영
    public void markSucceeded(
            String imageUrl,
            Integer width,
            Integer height,
            String fitSummaryJson,
            String disclaimer,
            String modelVersion,
            String promptVersion,
            LocalDateTime completedAt
    ) {
        this.status = TryOnJobStatus.SUCCEEDED.name();
        this.resultImageUrl = imageUrl;
        this.resultWidth = width;
        this.resultHeight = height;
        this.fitSummaryJson = fitSummaryJson;
        this.disclaimer = disclaimer;
        this.modelVersion = modelVersion;
        this.promptVersion = promptVersion;
        this.completedAt = completedAt;
        this.errorCode = null;
        this.errorMessage = null;
        this.errorRetryable = null;
    }

    // 생성 실패 원인 반영
    public void markFailed(
            String errorCode,
            String errorMessage,
            boolean retryable,
            LocalDateTime completedAt
    ) {
        this.status = TryOnJobStatus.FAILED.name();
        this.errorCode = errorCode;
        this.errorMessage = errorMessage;
        this.errorRetryable = retryable;
        this.completedAt = completedAt;
    }
}
