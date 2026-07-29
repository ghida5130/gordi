package com.ssafy.backend.controller;

import com.ssafy.backend.common.response.ApiResponse;
import com.ssafy.backend.dto.recommendation.RecommendationOptionsResponse;
import com.ssafy.backend.dto.recommendation.RecommendationRequest;
import com.ssafy.backend.dto.recommendation.RecommendationResponse;
import com.ssafy.backend.dto.recommendation.ReplacementRequest;
import com.ssafy.backend.dto.recommendation.ReplacementResponse;
import com.ssafy.backend.service.RecommendationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class RecommendationController {

    private static final String IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

    private final RecommendationService recommendationService;

    public RecommendationController(RecommendationService recommendationService) {
        this.recommendationService = recommendationService;
    }

    // 추천 옵션 조회 (카테고리·세부 분류·무드·예산 정책)
    @GetMapping("/recommendation-options")
    public ApiResponse<RecommendationOptionsResponse> readOptions() {
        return ApiResponse.success(recommendationService.readOptions());
    }

    // 추천 스냅샷 생성 (조건 기반)
    @PostMapping(value = "/recommendations", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<RecommendationResponse>> createRecommendation(
            @Valid @RequestBody RecommendationRequest request,
            @RequestHeader(value = IDEMPOTENCY_KEY_HEADER, required = false) String idempotencyKey
    ) {
        RecommendationResponse response = recommendationService.createSnapshot(request, idempotencyKey);

        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    // 추천 결과 조회 (저장된 스냅샷)
    @GetMapping("/recommendations/{recommendationId}")
    public ApiResponse<RecommendationResponse> readRecommendation(
            @PathVariable Long recommendationId
    ) {
        return ApiResponse.success(recommendationService.readSnapshot(recommendationId));
    }

    // 선택 상품 재추천 (교체 후 새 버전 생성)
    @PostMapping(
            value = "/recommendations/{recommendationId}/replacements",
            consumes = MediaType.APPLICATION_JSON_VALUE
    )
    public ApiResponse<ReplacementResponse> replaceRecommendationItems(
            @PathVariable Long recommendationId,
            @Valid @RequestBody ReplacementRequest request,
            @RequestHeader(value = IDEMPOTENCY_KEY_HEADER, required = false) String idempotencyKey
    ) {
        return ApiResponse.success(
                recommendationService.replaceItems(recommendationId, request, idempotencyKey)
        );
    }
}
