package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.config.TryOnPolicy;
import com.ssafy.backend.config.enums.TryOnContextType;
import com.ssafy.backend.config.enums.TryOnJobStatus;
import com.ssafy.backend.domain.Avatar;
import com.ssafy.backend.domain.TryOnJob;
import com.ssafy.backend.dto.tryon.TryOnJobStatusResponse;
import com.ssafy.backend.infra.TryOnGenerationClient;
import com.ssafy.backend.repository.TryOnJobRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TryOnJobReconciliationServiceTest {

    private static final Long JOB_ID = 71L;
    private static final long STALE_AFTER_MS = 120_000L;
    private static final int BATCH_SIZE = 20;
    private static final Instant COMPLETED_AT = Instant.parse("2026-07-23T01:20:09Z");

    @Mock
    private TryOnJobRepository tryOnJobRepository;
    @Mock
    private TryOnGenerationClient tryOnGenerationClient;

    private TryOnJobReconciliationService reconciliationService;

    @BeforeEach
    void setUp() {
        reconciliationService = new TryOnJobReconciliationService(
                tryOnJobRepository,
                tryOnGenerationClient,
                new TryOnPolicy(20, 1500L, 5, STALE_AFTER_MS, BATCH_SIZE)
        );
    }

    /* ==================== 대상 선별 ==================== */

    @Test
    void 지연_기준_시각과_배치_크기로_대상을_찾는다() {
        when(tryOnJobRepository.findStaleJobIds(any(), any())).thenReturn(List.of(JOB_ID));

        List<Long> found = reconciliationService.findStaleJobIds();

        assertThat(found).containsExactly(JOB_ID);

        ArgumentCaptor<LocalDateTime> threshold = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(tryOnJobRepository).findStaleJobIds(threshold.capture(), pageable.capture());

        assertThat(threshold.getValue()).isBefore(LocalDateTime.now());
        assertThat(pageable.getValue().getPageSize()).isEqualTo(BATCH_SIZE);
    }

    /* ==================== 보정 ==================== */

    @Test
    void 생성_서비스가_SUCCEEDED면_결과를_반영한다() {
        TryOnJob job = queuedJob();
        when(tryOnJobRepository.findById(JOB_ID)).thenReturn(Optional.of(job));
        when(tryOnGenerationClient.fetchStatus(JOB_ID)).thenReturn(Optional.of(succeeded()));

        boolean recovered = reconciliationService.reconcile(JOB_ID);

        assertThat(recovered).isTrue();
        assertThat(job.getStatus()).isEqualTo(TryOnJobStatus.SUCCEEDED.name());
        assertThat(job.getResultImageUrl()).isEqualTo("https://cdn.example.com/fittings/71.webp");
        assertThat(job.getFitSummary()).containsExactly("여유로운 상의 핏");
        assertThat(job.getAttempt()).isEqualTo(2);
        assertThat(job.isCacheHit()).isTrue();
        // 01:20:09Z -> KST 10:20:09
        assertThat(job.getCompletedAt()).isEqualTo(LocalDateTime.of(2026, 7, 23, 10, 20, 9));
    }

    @Test
    void 생성_서비스가_FAILED면_실패_원인을_반영한다() {
        TryOnJob job = queuedJob();
        when(tryOnJobRepository.findById(JOB_ID)).thenReturn(Optional.of(job));
        when(tryOnGenerationClient.fetchStatus(JOB_ID)).thenReturn(Optional.of(failed()));

        boolean recovered = reconciliationService.reconcile(JOB_ID);

        assertThat(recovered).isTrue();
        assertThat(job.getStatus()).isEqualTo(TryOnJobStatus.FAILED.name());
        assertThat(job.getErrorCode()).isEqualTo("IMAGE_MODEL_TIMEOUT");
        assertThat(job.isRetryable()).isTrue();
    }

    @Test
    void 아직_처리중이면_상태를_바꾸지_않는다() {
        TryOnJob job = queuedJob();
        when(tryOnJobRepository.findById(JOB_ID)).thenReturn(Optional.of(job));
        when(tryOnGenerationClient.fetchStatus(JOB_ID))
                .thenReturn(Optional.of(statusOnly(TryOnJobStatus.RUNNING.name())));

        boolean recovered = reconciliationService.reconcile(JOB_ID);

        assertThat(recovered).isFalse();
        assertThat(job.getStatus()).isEqualTo(TryOnJobStatus.QUEUED.name());
    }

    @Test
    void 그_사이_콜백이_도착했으면_조회하지_않는다() {
        TryOnJob job = queuedJob();
        job.markSucceeded("url", 1, 1, List.of(), null, "m", "v1", LocalDateTime.now());
        when(tryOnJobRepository.findById(JOB_ID)).thenReturn(Optional.of(job));

        boolean recovered = reconciliationService.reconcile(JOB_ID);

        assertThat(recovered).isFalse();
        verify(tryOnGenerationClient, never()).fetchStatus(any());
    }

    @Test
    void 생성_서비스가_Job을_모르면_상태를_바꾸지_않는다() {
        TryOnJob job = queuedJob();
        when(tryOnJobRepository.findById(JOB_ID)).thenReturn(Optional.of(job));
        when(tryOnGenerationClient.fetchStatus(JOB_ID)).thenReturn(Optional.empty());

        boolean recovered = reconciliationService.reconcile(JOB_ID);

        assertThat(recovered).isFalse();
        assertThat(job.getStatus()).isEqualTo(TryOnJobStatus.QUEUED.name());
    }

    @Test
    void 없는_Job은_조용히_건너뛴다() {
        when(tryOnJobRepository.findById(JOB_ID)).thenReturn(Optional.empty());

        assertThat(reconciliationService.reconcile(JOB_ID)).isFalse();
        verify(tryOnGenerationClient, never()).fetchStatus(any());
    }

    @Test
    void 알_수_없는_상태_문자열은_보정하지_않는다() {
        TryOnJob job = queuedJob();
        when(tryOnJobRepository.findById(JOB_ID)).thenReturn(Optional.of(job));
        when(tryOnGenerationClient.fetchStatus(JOB_ID))
                .thenReturn(Optional.of(statusOnly("CANCELLED")));

        assertThat(reconciliationService.reconcile(JOB_ID)).isFalse();
        assertThat(job.getStatus()).isEqualTo(TryOnJobStatus.QUEUED.name());
    }

    @Test
    void result_없는_SUCCEEDED는_보정하지_않는다() {
        TryOnJob job = queuedJob();
        when(tryOnJobRepository.findById(JOB_ID)).thenReturn(Optional.of(job));
        when(tryOnGenerationClient.fetchStatus(JOB_ID))
                .thenReturn(Optional.of(statusOnly(TryOnJobStatus.SUCCEEDED.name())));

        assertThat(reconciliationService.reconcile(JOB_ID)).isFalse();
        assertThat(job.getStatus()).isEqualTo(TryOnJobStatus.QUEUED.name());
    }

    @Test
    void 통신_실패는_호출측이_처리하도록_전파한다() {
        TryOnJob job = queuedJob();
        when(tryOnJobRepository.findById(JOB_ID)).thenReturn(Optional.of(job));
        when(tryOnGenerationClient.fetchStatus(JOB_ID))
                .thenThrow(new ApiException(ErrorCode.DEPENDENCY_UNAVAILABLE));

        assertThatThrownBy(() -> reconciliationService.reconcile(JOB_ID))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.DEPENDENCY_UNAVAILABLE);
    }

    /* ==================== 픽스처 ==================== */

    private TryOnJob queuedJob() {
        TryOnJob job = TryOnJob.builder()
                .contextType(TryOnContextType.SOLO.name())
                .avatar(Avatar.builder().id(38L).gender("FEMALE").bodyType("STANDARD")
                        .imageUrl("https://cdn.example.com/avatars/38.webp")
                        .heightId(3L).weightId(2L).build())
                .status(TryOnJobStatus.QUEUED.name())
                .build();
        job.setId(JOB_ID);
        return job;
    }

    private TryOnJobStatusResponse.Data succeeded() {
        return new TryOnJobStatusResponse.Data(
                JOB_ID,
                TryOnJobStatus.SUCCEEDED.name(),
                2,
                true,
                new TryOnJobStatusResponse.Result(
                        "https://cdn.example.com/fittings/71.webp", 1024, 1536,
                        List.of("여유로운 상의 핏"), "생성 이미지는 실제 핏과 다를 수 있습니다."),
                null,
                "provider-model-version",
                "v1",
                Instant.parse("2026-07-23T01:20:00Z"),
                COMPLETED_AT
        );
    }

    private TryOnJobStatusResponse.Data failed() {
        return new TryOnJobStatusResponse.Data(
                JOB_ID,
                TryOnJobStatus.FAILED.name(),
                1,
                false,
                null,
                new TryOnJobStatusResponse.Error(
                        "IMAGE_MODEL_TIMEOUT", "착장 이미지를 생성하지 못했습니다.", true),
                "provider-model-version",
                "v1",
                Instant.parse("2026-07-23T01:20:00Z"),
                COMPLETED_AT
        );
    }

    private TryOnJobStatusResponse.Data statusOnly(String status) {
        return new TryOnJobStatusResponse.Data(
                JOB_ID, status, 1, false, null, null, null, null, null, null);
    }
}
