package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.config.enums.TryOnContextType;
import com.ssafy.backend.config.enums.TryOnJobEventType;
import com.ssafy.backend.config.enums.TryOnJobStatus;
import com.ssafy.backend.domain.Avatar;
import com.ssafy.backend.domain.TryOnJob;
import com.ssafy.backend.domain.TryOnJobEvent;
import com.ssafy.backend.dto.tryon.TryOnJobEventRequest;
import com.ssafy.backend.repository.TryOnJobEventRepository;
import com.ssafy.backend.repository.TryOnJobRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TryOnJobEventServiceTest {

    private static final Long JOB_ID = 71L;
    private static final String EVENT_ID = "9348d09e-bc51-4d7f-b6aa-e39d72c5e81b";
    private static final Instant OCCURRED_AT = Instant.parse("2026-07-23T01:20:09Z");

    @Mock
    private TryOnJobRepository tryOnJobRepository;
    @Mock
    private TryOnJobEventRepository tryOnJobEventRepository;

    private TryOnJobEventService tryOnJobEventService;

    @BeforeEach
    void setUp() {
        tryOnJobEventService = new TryOnJobEventService(
                tryOnJobRepository, tryOnJobEventRepository);
    }

    /* ==================== 상태 전이 ==================== */

    @Test
    void PROCESSING_이벤트는_RUNNING으로_전이한다() {
        TryOnJob job = queuedJob();
        stubJob(job);

        tryOnJobEventService.apply(JOB_ID, processingEvent(1L));

        assertThat(job.getStatus()).isEqualTo(TryOnJobStatus.RUNNING.name());
        assertThat(job.getLastEventSequence()).isEqualTo(1L);
        assertThat(job.getAttempt()).isEqualTo(1);
    }

    @Test
    void SUCCEEDED_이벤트는_결과를_반영한다() {
        TryOnJob job = queuedJob();
        stubJob(job);

        tryOnJobEventService.apply(JOB_ID, succeededEvent(2L));

        assertThat(job.getStatus()).isEqualTo(TryOnJobStatus.SUCCEEDED.name());
        assertThat(job.getResultImageUrl()).isEqualTo("https://cdn.example.com/fittings/71.webp");
        assertThat(job.getResultWidth()).isEqualTo(1024);
        assertThat(job.getResultHeight()).isEqualTo(1536);
        assertThat(job.getDisclaimer()).isEqualTo("생성 이미지는 실제 핏과 다를 수 있습니다.");
        assertThat(job.getModelVersion()).isEqualTo("provider-model-version");
        assertThat(job.getPromptVersion()).isEqualTo("v1");
        assertThat(job.isCacheHit()).isFalse();
        // KST 저장 (01:20:09Z -> 10:20:09)
        assertThat(job.getCompletedAt()).isEqualTo(LocalDateTime.of(2026, 7, 23, 10, 20, 9));
    }

    @Test
    void SUCCEEDED_이벤트의_fitSummary가_반영된다() {
        TryOnJob job = queuedJob();
        stubJob(job);

        tryOnJobEventService.apply(JOB_ID, succeededEvent(2L));

        assertThat(job.getFitSummary()).containsExactly("여유로운 상의 핏");
    }

    @Test
    void FAILED_이벤트는_실패_원인과_retryable을_반영한다() {
        TryOnJob job = queuedJob();
        stubJob(job);

        tryOnJobEventService.apply(JOB_ID, failedEvent(2L, true));

        assertThat(job.getStatus()).isEqualTo(TryOnJobStatus.FAILED.name());
        assertThat(job.getErrorCode()).isEqualTo("IMAGE_MODEL_TIMEOUT");
        assertThat(job.getErrorRetryable()).isTrue();
        assertThat(job.isRetryable()).isTrue();
        assertThat(job.getModelVersion()).isEqualTo("provider-model-version");
    }

    @Test
    void cacheHit이_참이면_Job에_반영된다() {
        TryOnJob job = queuedJob();
        stubJob(job);

        TryOnJobEventRequest request = new TryOnJobEventRequest(
                EVENT_ID, 2L, TryOnJobEventType.SUCCEEDED.name(), 1,
                new TryOnJobEventRequest.Result("url", 1, 1, List.of(), null),
                true, null, "m", "v1", OCCURRED_AT);

        tryOnJobEventService.apply(JOB_ID, request);

        assertThat(job.isCacheHit()).isTrue();
    }

    /* ==================== 멱등·순서 ==================== */

    @Test
    void 같은_eventId_재전송은_상태를_바꾸지_않는다() {
        TryOnJob job = queuedJob();
        when(tryOnJobRepository.findById(JOB_ID)).thenReturn(Optional.of(job));
        when(tryOnJobEventRepository.existsByTryOnJobIdAndEventId(JOB_ID, EVENT_ID)).thenReturn(true);

        tryOnJobEventService.apply(JOB_ID, succeededEvent(2L));

        assertThat(job.getStatus()).isEqualTo(TryOnJobStatus.QUEUED.name());
        assertThat(job.getLastEventSequence()).isNull();
        verify(tryOnJobEventRepository, never()).save(any());
    }

    @Test
    void 이전_sequence_이벤트는_무시하되_수신은_기록한다() {
        TryOnJob job = queuedJob();
        job.setLastEventSequence(5L);
        job.markRunning();
        stubJob(job);

        tryOnJobEventService.apply(JOB_ID, succeededEvent(3L));

        assertThat(job.getStatus()).isEqualTo(TryOnJobStatus.RUNNING.name());
        assertThat(job.getLastEventSequence()).isEqualTo(5L);
        verify(tryOnJobEventRepository).save(any(TryOnJobEvent.class));
    }

    @Test
    void 같은_sequence_이벤트도_무시한다() {
        TryOnJob job = queuedJob();
        job.setLastEventSequence(2L);
        stubJob(job);

        tryOnJobEventService.apply(JOB_ID, succeededEvent(2L));

        assertThat(job.getStatus()).isEqualTo(TryOnJobStatus.QUEUED.name());
    }

    @Test
    void 이미_끝난_Job에_늦은_PROCESSING이_와도_되돌리지_않는다() {
        TryOnJob job = queuedJob();
        job.markSucceeded("url", 1, 1, null, null, "m", "v1", LocalDateTime.now());
        stubJob(job);

        tryOnJobEventService.apply(JOB_ID, processingEvent(9L));

        assertThat(job.getStatus()).isEqualTo(TryOnJobStatus.SUCCEEDED.name());
    }

    @Test
    void 수신_기록에_eventId와_sequence가_남는다() {
        TryOnJob job = queuedJob();
        stubJob(job);

        tryOnJobEventService.apply(JOB_ID, processingEvent(1L));

        ArgumentCaptor<TryOnJobEvent> saved = ArgumentCaptor.forClass(TryOnJobEvent.class);
        verify(tryOnJobEventRepository).save(saved.capture());
        assertThat(saved.getValue().getEventId()).isEqualTo(EVENT_ID);
        assertThat(saved.getValue().getSequence()).isEqualTo(1L);
        assertThat(saved.getValue().getEventType()).isEqualTo(TryOnJobEventType.PROCESSING.name());
        assertThat(saved.getValue().getTryOnJob()).isSameAs(job);
    }

    /* ==================== 오류 ==================== */

    @Test
    void 없는_Job은_RESOURCE_NOT_FOUND() {
        when(tryOnJobRepository.findById(JOB_ID)).thenReturn(Optional.empty());

        TryOnJobEventRequest request = processingEvent(1L);

        assertThatThrownBy(() -> tryOnJobEventService.apply(JOB_ID, request))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);
    }

    @Test
    void 알_수_없는_eventType은_BAD_REQUEST() {
        TryOnJobEventRequest request = new TryOnJobEventRequest(
                EVENT_ID, 1L, "CANCELLED", 1, null, null, null, null, null, OCCURRED_AT);

        assertThatThrownBy(() -> tryOnJobEventService.apply(JOB_ID, request))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.BAD_REQUEST);
    }

    @Test
    void result_없는_SUCCEEDED는_BAD_REQUEST() {
        TryOnJob job = queuedJob();
        stubJob(job);

        TryOnJobEventRequest request = new TryOnJobEventRequest(
                EVENT_ID, 2L, TryOnJobEventType.SUCCEEDED.name(), 1,
                null, false, null, "m", "v1", OCCURRED_AT);

        assertThatThrownBy(() -> tryOnJobEventService.apply(JOB_ID, request))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.BAD_REQUEST);
    }

    @Test
    void error_없는_FAILED는_BAD_REQUEST() {
        TryOnJob job = queuedJob();
        stubJob(job);

        TryOnJobEventRequest request = new TryOnJobEventRequest(
                EVENT_ID, 2L, TryOnJobEventType.FAILED.name(), 1,
                null, false, null, "m", "v1", OCCURRED_AT);

        assertThatThrownBy(() -> tryOnJobEventService.apply(JOB_ID, request))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ErrorCode.BAD_REQUEST);
    }

    /* ==================== 픽스처 ==================== */

    private void stubJob(TryOnJob job) {
        when(tryOnJobRepository.findById(JOB_ID)).thenReturn(Optional.of(job));
        when(tryOnJobEventRepository.existsByTryOnJobIdAndEventId(anyLong(), anyString())).thenReturn(false);
    }

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

    private TryOnJobEventRequest processingEvent(long sequence) {
        return new TryOnJobEventRequest(
                EVENT_ID, sequence, TryOnJobEventType.PROCESSING.name(), 1,
                null, null, null, null, null, OCCURRED_AT);
    }

    private TryOnJobEventRequest succeededEvent(long sequence) {
        return new TryOnJobEventRequest(
                EVENT_ID, sequence, TryOnJobEventType.SUCCEEDED.name(), 1,
                new TryOnJobEventRequest.Result(
                        "https://cdn.example.com/fittings/71.webp", 1024, 1536,
                        List.of("여유로운 상의 핏"), "생성 이미지는 실제 핏과 다를 수 있습니다."),
                false, null, "provider-model-version", "v1", OCCURRED_AT);
    }

    private TryOnJobEventRequest failedEvent(long sequence, boolean retryable) {
        return new TryOnJobEventRequest(
                EVENT_ID, sequence, TryOnJobEventType.FAILED.name(), 1,
                null, false,
                new TryOnJobEventRequest.Error(
                        "IMAGE_MODEL_TIMEOUT", "착장 이미지를 생성하지 못했습니다.", retryable),
                "provider-model-version", "v1", OCCURRED_AT);
    }
}
