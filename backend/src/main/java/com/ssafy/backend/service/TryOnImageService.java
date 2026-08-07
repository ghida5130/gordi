package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.config.enums.TryOnJobStatus;
import com.ssafy.backend.domain.TryOnJob;
import com.ssafy.backend.dto.tryon.TryOnImageListResponseDTO;
import com.ssafy.backend.repository.TryOnJobRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TryOnImageService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final Sort LATEST_FIRST = Sort.by(
            Sort.Order.desc("createdAt"),
            Sort.Order.desc("id")
    );

    private final TryOnJobRepository tryOnJobRepository;

    public TryOnImageListResponseDTO readMyImages(String email, int page, int size) {
        validatePageRequest(page, size);

        Page<TryOnJob> jobs = tryOnJobRepository
                .findAllByOwnerUserEmailAndStatusAndResultImageUrlIsNotNull(
                        email,
                        TryOnJobStatus.SUCCEEDED.name(),
                        PageRequest.of(page, size, LATEST_FIRST)
                );

        return new TryOnImageListResponseDTO(
                jobs.getContent().stream().map(this::toItem).toList(),
                jobs.getNumber(),
                jobs.getSize(),
                jobs.getTotalElements()
        );
    }

    private void validatePageRequest(int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ApiException(
                    ErrorCode.BAD_REQUEST,
                    "page는 0 이상, size는 1 이상 100 이하여야 합니다.",
                    Map.of("page", page, "size", size)
            );
        }
    }

    private TryOnImageListResponseDTO.Item toItem(TryOnJob job) {
        return new TryOnImageListResponseDTO.Item(
                job.getId(),
                job.getResultImageUrl(),
                job.getResultWidth(),
                job.getResultHeight(),
                toInstant(job.getCreatedAt()),
                toInstant(job.getCompletedAt())
        );
    }

    private Instant toInstant(LocalDateTime value) {
        return value == null ? null : value.atZone(AppZone.KST).toInstant();
    }
}
