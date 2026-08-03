package com.ssafy.backend.controller;

import com.ssafy.backend.dto.tryon.TryOnJobEventRequest;
import com.ssafy.backend.service.TryOnJobEventService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 내부 호출 전용 착장 Job 엔드포인트. 프론트엔드에 공개하지 않는다.
 * 접근 통제는 {@link com.ssafy.backend.filter.InternalTokenFilter} 가 담당한다.
 */
@RestController
@RequestMapping("/internal/v1/try-on-jobs")
@RequiredArgsConstructor
public class InternalTryOnJobController {

    private final TryOnJobEventService tryOnJobEventService;

    /**
     * 생성 상태·결과 콜백 수신.
     * 중복 이벤트와 늦게 도착한 이벤트도 오류가 아니라 204 로 응답한다.
     */
    @PostMapping("/{jobId}/events")
    public ResponseEntity<Void> receiveEvent(
            @PathVariable Long jobId,
            @RequestBody @Valid TryOnJobEventRequest request
    ) {
        tryOnJobEventService.apply(jobId, request);
        return ResponseEntity.noContent().build();
    }
}
