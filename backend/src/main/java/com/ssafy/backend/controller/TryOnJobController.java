package com.ssafy.backend.controller;

import com.ssafy.backend.common.response.ApiResponse;
import com.ssafy.backend.dto.tryon.TryOnJobCreateRequestDTO;
import com.ssafy.backend.dto.tryon.TryOnJobCreateResponseDTO;
import com.ssafy.backend.dto.tryon.TryOnJobDetailResponseDTO;
import com.ssafy.backend.dto.tryon.TryOnJobRetryResponseDTO;
import com.ssafy.backend.service.TryOnService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/try-on-jobs")
@RequiredArgsConstructor
public class TryOnJobController {

    private final TryOnService tryOnService;

    /** 착장 Job 상태·결과·실패 원인 조회. 실패한 Job 도 200 + status=FAILED 로 반환한다. */
    @GetMapping("/{jobId}")
    public ResponseEntity<ApiResponse<TryOnJobDetailResponseDTO>> read(
            @PathVariable Long jobId,
            Authentication authentication
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                tryOnService.read(jobId, authentication.getName())));
    }

    /** 착장 이미지 생성 Job 등록. 접수만 하고 결과는 조회 API 로 폴링한다. */
    @PostMapping
    public ResponseEntity<ApiResponse<TryOnJobCreateResponseDTO>> create(
            @RequestBody @Valid TryOnJobCreateRequestDTO request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            Authentication authentication
    ) {
        TryOnJobCreateResponseDTO response =
                tryOnService.create(request, idempotencyKey, authentication.getName());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse.success(response));
    }

    /** 재시도 가능한 실패 Job 을 새 Job 으로 등록 */
    @PostMapping("/{jobId}/retry")
    public ResponseEntity<ApiResponse<TryOnJobRetryResponseDTO>> retry(
            @PathVariable Long jobId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            Authentication authentication
    ) {
        TryOnJobRetryResponseDTO response =
                tryOnService.retry(jobId, idempotencyKey, authentication.getName());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse.success(response));
    }
}
