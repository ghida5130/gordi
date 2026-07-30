package com.ssafy.backend.infra;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.dto.tryon.TryOnGenerationRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

// FastAPI 착장 생성 접수 호출 (/internal/v1/try-on-jobs)
@Component
public class TryOnGenerationRestClient implements TryOnGenerationClient {

    private static final Logger log = LoggerFactory.getLogger(TryOnGenerationRestClient.class);
    private static final String SUBMIT_PATH = "/internal/v1/try-on-jobs";
    private static final String INTERNAL_KEY_HEADER = "X-Internal-Api-Key";

    private final RestClient aiRestClient;
    private final String internalApiKey;

    public TryOnGenerationRestClient(
            RestClient aiRestClient,
            @Value("${gordi.ai.internal-api-key:}") String internalApiKey
    ) {
        this.aiRestClient = aiRestClient;
        this.internalApiKey = internalApiKey;
    }

    @Override
    public void submit(TryOnGenerationRequest request) {
        try {
            aiRestClient.post()
                    .uri(SUBMIT_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .headers(headers -> {
                        if (StringUtils.hasText(internalApiKey)) {
                            headers.set(INTERNAL_KEY_HEADER, internalApiKey);
                        }
                    })
                    .body(request)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException exception) {
            log.error(
                    "FastAPI try-on submit failed. jobId={}, exceptionType={}",
                    request.jobId(),
                    exception.getClass().getName()
            );
            throw new ApiException(ErrorCode.DEPENDENCY_UNAVAILABLE, "착장 이미지 생성 서비스를 사용할 수 없습니다.");
        }
    }
}
