package com.ssafy.backend.infra;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.error.RequestIdUtils;
import com.ssafy.backend.dto.tryon.TryOnGenerationRequest;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.UUID;

// FastAPI 착장 생성 접수 호출 (/internal/v1/try-on-jobs)
@Component
public class TryOnGenerationRestClient implements TryOnGenerationClient {

    private static final Logger log = LoggerFactory.getLogger(TryOnGenerationRestClient.class);

    private static final String SUBMIT_PATH = "/internal/v1/try-on-jobs";
    private static final String INTERNAL_TOKEN_HEADER = "X-Internal-Token";
    private static final String IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

    private final RestClient aiRestClient;
    private final String internalToken;

    public TryOnGenerationRestClient(
            RestClient aiRestClient,
            @Value("${gordi.internal.token:}") String internalToken
    ) {
        this.aiRestClient = aiRestClient;
        this.internalToken = internalToken;
    }

    @Override
    public void submit(TryOnGenerationRequest request) {
        String requestId = currentRequestId();

        try {
            aiRestClient.post()
                    .uri(SUBMIT_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .headers(headers -> {
                        if (StringUtils.hasText(internalToken)) {
                            headers.set(INTERNAL_TOKEN_HEADER, internalToken);
                        }
                        headers.set(RequestIdUtils.REQUEST_ID_HEADER, requestId);
                        // Job 하나당 접수는 한 번이므로 jobId 를 멱등 키로 쓴다.
                        headers.set(IDEMPOTENCY_KEY_HEADER, "try-on-job-" + request.jobId());
                    })
                    .body(request)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException exception) {
            log.error(
                    "FastAPI try-on submit failed. jobId={}, requestId={}, exceptionType={}",
                    request.jobId(),
                    requestId,
                    exception.getClass().getName()
            );
            throw new ApiException(ErrorCode.DEPENDENCY_UNAVAILABLE, "착장 이미지 생성 서비스를 사용할 수 없습니다.");
        }
    }

    /** 처리 중인 HTTP 요청의 requestId 를 이어붙인다. 요청 컨텍스트 밖(스케줄러 등)이면 새로 만든다. */
    private String currentRequestId() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            HttpServletRequest request = attributes.getRequest();
            return RequestIdUtils.resolve(request);
        }
        return UUID.randomUUID().toString();
    }
}
