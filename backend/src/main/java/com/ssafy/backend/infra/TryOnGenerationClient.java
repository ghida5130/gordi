package com.ssafy.backend.infra;

import com.ssafy.backend.dto.tryon.TryOnGenerationRequest;

/**
 * 착장 이미지 생성 요청 전송 경계.
 * <p>
 * Service 는 전송 수단(HTTP / 메시지 큐)을 알지 않는다.
 * 생성 결과가 도착해 Job 을 SUCCEEDED/FAILED 로 전이시키는 경로는 팀 합의 대기 중이며,
 * 확정되면 이 인터페이스의 구현체와 완료 처리 진입점만 추가하면 된다.
 */
public interface TryOnGenerationClient {

    /**
     * 생성 작업을 접수시킨다. 접수 실패는 DEPENDENCY_UNAVAILABLE 로 변환된다.
     * 반환은 없으며, 결과는 Job 의 상태 전이로 별도 경로에서 반영된다.
     */
    void submit(TryOnGenerationRequest request);
}
