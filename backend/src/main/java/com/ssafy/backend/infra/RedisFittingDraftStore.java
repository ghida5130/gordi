package com.ssafy.backend.infra;

import com.ssafy.backend.websocket.dto.FittingDraftSnapshotDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 방별 피팅 초안을 Redis에 저장한다.
 *
 * <p>revision 비교와 전체 스냅샷 교체는 Lua script 한 번으로 실행되어 여러 서버
 * 인스턴스에서도 원자성을 유지한다.</p>
 */
@Component
public class RedisFittingDraftStore {

    private static final Logger log = LoggerFactory.getLogger(RedisFittingDraftStore.class);
    private static final String KEY_FORMAT = "room:fitting-draft:v1:{%d}";
    private static final String REVISION_FIELD = "draftRevision";
    private static final String SNAPSHOT_FIELD = "snapshot";
    private static final long REVISION_CONFLICT = -1L;

    private static final DefaultRedisScript<Long> COMPARE_AND_SET_SCRIPT = new DefaultRedisScript<>(
            """
            local current = redis.call('HGET', KEYS[1], 'draftRevision')
            if not current then
                current = '0'
            end
            if current ~= ARGV[1] then
                return -1
            end
            redis.call('HSET', KEYS[1],
                'draftRevision', ARGV[2],
                'snapshot', ARGV[3])
            redis.call('PEXPIRE', KEYS[1], ARGV[4])
            return tonumber(ARGV[2])
            """,
            Long.class
    );

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public RedisFittingDraftStore(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * expectedRevision과 Redis의 최신 revision이 같을 때만 스냅샷을 저장한다.
     *
     * @return revision 충돌이면 false, 저장 성공이면 true
     */
    public boolean compareAndSet(
            Long roomId,
            long expectedRevision,
            FittingDraftSnapshotDTO snapshot,
            Duration ttl
    ) {
        try {
            String serialized = objectMapper.writeValueAsString(snapshot);
            Long result = redisTemplate.execute(
                    COMPARE_AND_SET_SCRIPT,
                    List.of(key(roomId)),
                    Long.toString(expectedRevision),
                    Long.toString(snapshot.draftRevision()),
                    serialized,
                    Long.toString(Math.max(1L, ttl.toMillis()))
            );
            if (result == null) {
                throw new IllegalStateException("Redis fitting draft script returned no result");
            }
            return result != REVISION_CONFLICT;
        } catch (RuntimeException exception) {
            log.warn(
                    "Fitting draft write failed. roomId={}, exceptionType={}",
                    roomId,
                    exception.getClass().getName()
            );
            throw exception;
        }
    }

    public Optional<FittingDraftSnapshotDTO> findByRoomId(Long roomId) {
        Map<Object, Object> values = redisTemplate.opsForHash().entries(key(roomId));
        if (values.isEmpty()) {
            return Optional.empty();
        }

        Object revisionValue = values.get(REVISION_FIELD);
        Object snapshotValue = values.get(SNAPSHOT_FIELD);
        if (revisionValue == null || snapshotValue == null) {
            evictInvalid(roomId, "missing_field");
            return Optional.empty();
        }

        try {
            long storedRevision = Long.parseLong(revisionValue.toString());
            FittingDraftSnapshotDTO snapshot = objectMapper.readValue(
                    snapshotValue.toString(),
                    FittingDraftSnapshotDTO.class
            );
            if (snapshot.draftRevision() == null || snapshot.draftRevision() != storedRevision) {
                evictInvalid(roomId, "revision_mismatch");
                return Optional.empty();
            }
            return Optional.of(snapshot);
        } catch (Exception exception) {
            log.warn(
                    "Fitting draft payload could not be restored. roomId={}, exceptionType={}",
                    roomId,
                    exception.getClass().getName()
            );
            evictInvalid(roomId, "deserialization_failed");
            return Optional.empty();
        }
    }

    private void evictInvalid(Long roomId, String reason) {
        try {
            redisTemplate.delete(key(roomId));
            log.debug("Invalid fitting draft was evicted. roomId={}, reason={}", roomId, reason);
        } catch (RuntimeException exception) {
            log.warn(
                    "Invalid fitting draft could not be evicted. roomId={}, exceptionType={}",
                    roomId,
                    exception.getClass().getName()
            );
        }
    }

    private String key(Long roomId) {
        return KEY_FORMAT.formatted(roomId);
    }
}
