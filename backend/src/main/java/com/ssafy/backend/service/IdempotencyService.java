package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.domain.IdempotencyRecord;
import com.ssafy.backend.repository.IdempotencyRecordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;

// Idempotency-Key 처리 (키가 없으면 멱등 보장 없이 그대로 수행)
@Service
public class IdempotencyService {

    private static final Logger log = LoggerFactory.getLogger(IdempotencyService.class);

    private final IdempotencyRecordRepository idempotencyRecordRepository;
    private final ObjectMapper objectMapper;

    public IdempotencyService(
            IdempotencyRecordRepository idempotencyRecordRepository,
            ObjectMapper objectMapper
    ) {
        this.idempotencyRecordRepository = idempotencyRecordRepository;
        this.objectMapper = objectMapper;
    }

    // 요청 본문을 식별하는 해시 (같은 키 + 다른 본문 탐지용)
    public String hashRequest(Object... parts) {
        StringBuilder joined = new StringBuilder();
        for (Object part : parts) {
            joined.append(part).append('|');
        }

        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(joined.toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 알고리즘을 사용할 수 없습니다.", exception);
        }
    }

    // 같은 키로 이미 처리된 요청이면 저장된 응답을 그대로 반환
    public <T> Optional<T> findReplay(
            Long userId,
            String idempotencyKey,
            String endpoint,
            String requestHash,
            Class<T> responseType
    ) {
        if (!StringUtils.hasText(idempotencyKey)) {
            return Optional.empty();
        }

        Optional<IdempotencyRecord> found =
                idempotencyRecordRepository.findByUserIdAndIdempotencyKey(userId, idempotencyKey);
        if (found.isEmpty()) {
            return Optional.empty();
        }

        IdempotencyRecord record = found.get();
        if (!record.getEndpoint().equals(endpoint) || !record.getRequestHash().equals(requestHash)) {
            throw new ApiException(
                    ErrorCode.IDEMPOTENCY_KEY_REUSED,
                    Map.of("idempotencyKey", idempotencyKey)
            );
        }

        try {
            return Optional.of(objectMapper.readValue(record.getResponseBody(), responseType));
        } catch (Exception exception) {
            // 저장된 응답을 복원할 수 없으면 멱등 재생을 포기하고 정상 흐름으로 진행
            log.warn(
                    "Stored idempotent response could not be restored. recordId={}, exceptionType={}",
                    record.getId(),
                    exception.getClass().getName()
            );
            return Optional.empty();
        }
    }

    // 처리 결과 기록 (동일 키 동시 요청은 유니크 제약으로 409 CONFLICT 처리)
    public void remember(
            Long userId,
            String idempotencyKey,
            String endpoint,
            String requestHash,
            Long recommendationId,
            Long recommendationVersion,
            Object response
    ) {
        if (!StringUtils.hasText(idempotencyKey)) {
            return;
        }

        String serialized;
        try {
            serialized = objectMapper.writeValueAsString(response);
        } catch (Exception exception) {
            log.warn(
                    "Idempotent response could not be serialized. endpoint={}, exceptionType={}",
                    endpoint,
                    exception.getClass().getName()
            );
            return;
        }

        idempotencyRecordRepository.save(IdempotencyRecord.builder()
                .userId(userId)
                .idempotencyKey(idempotencyKey)
                .endpoint(endpoint)
                .requestHash(requestHash)
                .recommendationId(recommendationId)
                .recommendationVersion(recommendationVersion)
                .responseBody(serialized)
                .build());
    }
}
