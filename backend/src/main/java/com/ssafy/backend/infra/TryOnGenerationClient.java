package com.ssafy.backend.infra;

import com.ssafy.backend.dto.tryon.TryOnGenerationRequest;
import com.ssafy.backend.dto.tryon.TryOnJobStatusResponse;

import java.util.Optional;

/**
 * 착장 이미지 생성 서비스와의 통신 경계.
 * <p>
 * Service 는 전송 수단(HTTP / 메시지 큐)을 알지 않는다.
 * 정상 경로에서는 생성 결과가 콜백으로 도착하고, 콜백이 유실된 경우에만
 * {@link #fetchStatus(Long)} 로 실제 상태를 조회해 정합을 맞춘다.
 */
public interface TryOnGenerationClient {

    /**
     * 생성 작업을 접수시킨다. 접수 실패는 DEPENDENCY_UNAVAILABLE 로 변환된다.
     * 반환은 없으며, 결과는 Job 의 상태 전이로 별도 경로에서 반영된다.
     */
    void submit(TryOnGenerationRequest request);

    /**
     * 생성 서비스가 보는 Job 의 실제 상태를 조회한다.
     *
     * @return 생성 서비스가 해당 Job 을 모르면 빈 값
     * @throws com.ssafy.backend.common.error.ApiException 통신 실패 시 DEPENDENCY_UNAVAILABLE
     */
    Optional<TryOnJobStatusResponse.Data> fetchStatus(Long jobId);
}
