package com.ssafy.backend.infra;

import com.ssafy.backend.websocket.dto.FittingDraftSizeSelectionDTO;
import com.ssafy.backend.websocket.dto.FittingDraftSnapshotDTO;
import com.ssafy.backend.websocket.dto.FittingDraftWearOptionsDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RedisFittingDraftStoreTest {

    private static final String KEY = "room:fitting-draft:v1:{31}";

    @Mock
    private StringRedisTemplate redisTemplate;
    @Mock
    private HashOperations<String, Object, Object> hashOperations;

    private RedisFittingDraftStore store;

    @BeforeEach
    void setUp() {
        store = new RedisFittingDraftStore(redisTemplate, new ObjectMapper());
    }

    @Test
    @SuppressWarnings("unchecked")
    void revision_CAS와_TTL을_하나의_script로_저장한다() {
        FittingDraftSnapshotDTO snapshot = snapshot();
        when(redisTemplate.execute(any(RedisScript.class), eq(List.of(KEY)), any(), any(), any(), any()))
                .thenReturn(4L);

        boolean saved = store.compareAndSet(31L, 3L, snapshot, Duration.ofMinutes(10));

        assertThat(saved).isTrue();
        ArgumentCaptor<Object> expectedRevision = ArgumentCaptor.forClass(Object.class);
        ArgumentCaptor<Object> nextRevision = ArgumentCaptor.forClass(Object.class);
        ArgumentCaptor<Object> serialized = ArgumentCaptor.forClass(Object.class);
        ArgumentCaptor<Object> ttl = ArgumentCaptor.forClass(Object.class);
        verify(redisTemplate).execute(
                any(RedisScript.class),
                eq(List.of(KEY)),
                expectedRevision.capture(),
                nextRevision.capture(),
                serialized.capture(),
                ttl.capture()
        );
        assertThat(expectedRevision.getValue()).isEqualTo("3");
        assertThat(nextRevision.getValue()).isEqualTo("4");
        assertThat(serialized.getValue().toString()).contains("\"draftRevision\":4");
        assertThat(ttl.getValue()).isEqualTo("600000");
    }

    @Test
    @SuppressWarnings("unchecked")
    void Redis_revision이_다르면_저장하지_않았음을_반환한다() {
        when(redisTemplate.execute(any(RedisScript.class), anyList(), any(), any(), any(), any()))
                .thenReturn(-1L);

        assertThat(store.compareAndSet(31L, 3L, snapshot(), Duration.ofMinutes(10))).isFalse();
    }

    @Test
    void 저장된_전체_초안을_복원한다() throws Exception {
        FittingDraftSnapshotDTO snapshot = snapshot();
        when(redisTemplate.opsForHash()).thenReturn(hashOperations);
        when(hashOperations.entries(KEY)).thenReturn(Map.of(
                "draftRevision", "4",
                "snapshot", new ObjectMapper().writeValueAsString(snapshot)
        ));

        assertThat(store.findByRoomId(31L)).contains(snapshot);
        verify(redisTemplate, never()).delete(KEY);
    }

    @Test
    void 손상된_revision의_초안은_삭제한다() throws Exception {
        when(redisTemplate.opsForHash()).thenReturn(hashOperations);
        when(hashOperations.entries(KEY)).thenReturn(Map.of(
                "draftRevision", "5",
                "snapshot", new ObjectMapper().writeValueAsString(snapshot())
        ));

        assertThat(store.findByRoomId(31L)).isEmpty();
        verify(redisTemplate).delete(KEY);
    }

    private FittingDraftSnapshotDTO snapshot() {
        return new FittingDraftSnapshotDTO(
                4L,
                List.of(new FittingDraftSizeSelectionDTO(301L, "M")),
                new FittingDraftWearOptionsDTO("UNTUCKED", null, "ROLLED"),
                "소매를 한 번 접어주세요"
        );
    }
}
