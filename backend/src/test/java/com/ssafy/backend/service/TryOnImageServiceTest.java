package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.config.enums.TryOnJobStatus;
import com.ssafy.backend.domain.TryOnJob;
import com.ssafy.backend.dto.tryon.TryOnImageListResponseDTO;
import com.ssafy.backend.repository.TryOnJobRepository;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TryOnImageServiceTest {

    private final TryOnJobRepository tryOnJobRepository = mock(TryOnJobRepository.class);
    private final TryOnImageService tryOnImageService =
            new TryOnImageService(tryOnJobRepository);

    @Test
    void readMyImagesReturnsStoredSuccessfulJobImagesWithPagination() {
        LocalDateTime createdAt = LocalDateTime.of(2026, 8, 7, 10, 30);
        LocalDateTime completedAt = createdAt.plusSeconds(8);
        TryOnJob job = TryOnJob.builder()
                .id(71L)
                .status(TryOnJobStatus.SUCCEEDED.name())
                .resultImageUrl("https://cdn.example.com/fittings/job-71.webp")
                .resultWidth(1024)
                .resultHeight(1536)
                .createdAt(createdAt)
                .completedAt(completedAt)
                .build();
        when(tryOnJobRepository.findAllByOwnerUserEmailAndStatusAndResultImageUrlIsNotNull(
                eq("member@example.com"),
                eq(TryOnJobStatus.SUCCEEDED.name()),
                any(Pageable.class)
        )).thenReturn(new PageImpl<>(
                List.of(job),
                PageRequest.of(1, 10),
                25
        ));

        TryOnImageListResponseDTO response = tryOnImageService.readMyImages(
                "member@example.com",
                1,
                10
        );

        assertThat(response.page()).isEqualTo(1);
        assertThat(response.size()).isEqualTo(10);
        assertThat(response.totalElements()).isEqualTo(25);
        assertThat(response.images()).containsExactly(new TryOnImageListResponseDTO.Item(
                71L,
                "https://cdn.example.com/fittings/job-71.webp",
                1024,
                1536,
                createdAt.atZone(AppZone.KST).toInstant(),
                completedAt.atZone(AppZone.KST).toInstant()
        ));

        Pageable pageable = capturePageable();
        assertThat(pageable.getPageNumber()).isEqualTo(1);
        assertThat(pageable.getPageSize()).isEqualTo(10);
        assertThat(pageable.getSort().getOrderFor("createdAt").getDirection())
                .isEqualTo(Sort.Direction.DESC);
        assertThat(pageable.getSort().getOrderFor("id").getDirection())
                .isEqualTo(Sort.Direction.DESC);
    }

    @Test
    void readMyImagesReturnsEmptyPageWhenUserHasNoSuccessfulImages() {
        when(tryOnJobRepository.findAllByOwnerUserEmailAndStatusAndResultImageUrlIsNotNull(
                eq("member@example.com"),
                eq(TryOnJobStatus.SUCCEEDED.name()),
                any(Pageable.class)
        )).thenReturn(Page.empty(PageRequest.of(0, 20)));

        TryOnImageListResponseDTO response = tryOnImageService.readMyImages(
                "member@example.com",
                0,
                20
        );

        assertThat(response.images()).isEmpty();
        assertThat(response.totalElements()).isZero();
    }

    @Test
    void readMyImagesRejectsInvalidPagination() {
        assertThatThrownBy(() -> tryOnImageService.readMyImages(
                "member@example.com",
                -1,
                20
        )).isInstanceOfSatisfying(ApiException.class, exception ->
                assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.BAD_REQUEST));

        assertThatThrownBy(() -> tryOnImageService.readMyImages(
                "member@example.com",
                0,
                101
        )).isInstanceOfSatisfying(ApiException.class, exception ->
                assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.BAD_REQUEST));

        verify(tryOnJobRepository, never())
                .findAllByOwnerUserEmailAndStatusAndResultImageUrlIsNotNull(
                        any(), any(), any()
                );
    }

    private Pageable capturePageable() {
        org.mockito.ArgumentCaptor<Pageable> captor =
                org.mockito.ArgumentCaptor.forClass(Pageable.class);
        verify(tryOnJobRepository)
                .findAllByOwnerUserEmailAndStatusAndResultImageUrlIsNotNull(
                        eq("member@example.com"),
                        eq(TryOnJobStatus.SUCCEEDED.name()),
                        captor.capture()
                );
        return captor.getValue();
    }
}
