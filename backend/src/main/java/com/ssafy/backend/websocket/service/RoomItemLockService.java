package com.ssafy.backend.websocket.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.repository.RoomItemRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.websocket.dto.ItemLockRequestDTO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 아이템 드래그 잠금(ITEM_LOCKED) 처리.
 * <p>
 * 잠금은 드래그 중 충돌 방지용 휘발성 상태라 DB가 아닌 인메모리 맵으로 관리한다.
 * (스케일아웃 시 Redis 등 공유 저장소로 교체 필요)
 * - 원자성: ConcurrentHashMap.compute로 roomId+roomItemId 단위 획득을 원자적으로 수행
 * - 같은 참여자의 재요청은 성공으로 처리하고 lockToken을 갱신한다
 * - TTL이 지난 잠금은 만료로 간주하고 새 요청이 획득한다 (연결 끊김 등으로 인한 고아 잠금 방지)
 * - 방 버전은 증가시키지 않는다 (드래그만으로 배치 버전이 충돌하면 안 됨)
 */
@Service
public class RoomItemLockService {

    /** 잠금 보유 정보. lockToken은 소유자 검증용으로만 쓰고 절대 브로드캐스트하지 않는다. */
    public record ItemLock(
            Long participantId,
            String nickname,
            String lockToken,
            long lockedAtMillis
    ) {
    }

    /** 획득 시도 결과. acquired=false면 owner가 현재 잠금 보유자. */
    public record ItemLockResult(
            boolean acquired,
            Long roomVersion,
            ItemLock owner
    ) {
    }

    private record LockKey(Long roomId, Long roomItemId) {
    }

    private final ConcurrentHashMap<LockKey, ItemLock> locks = new ConcurrentHashMap<>();

    private final RoomRepository roomRepository;
    private final RoomItemRepository roomItemRepository;
    private final long lockTtlMillis;

    public RoomItemLockService(
            RoomRepository roomRepository,
            RoomItemRepository roomItemRepository,
            @Value("${room.item-lock-ttl:30000}") long lockTtlMillis
    ) {
        this.roomRepository = roomRepository;
        this.roomItemRepository = roomItemRepository;
        this.lockTtlMillis = lockTtlMillis;
    }

    // - 인자: 방 ID, 요청자 participantId/nickname, 잠금 요청(roomItemId/lockToken)
    // - 동작: 방·아이템 검증 후 잠금을 원자적으로 획득 시도.
    //         획득 성공(신규/재획득/만료 대체) 또는 현재 보유자 정보와 함께 거절 결과 반환
    public ItemLockResult tryLock(
            Long roomId,
            Long participantId,
            String nickname,
            ItemLockRequestDTO request
    ) {
        validateRequest(request);

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ApiException(ErrorCode.ROOM_NOT_FOUND));
        validateActive(room);

        Long roomItemId = request.data().roomItemId();
        if (!roomItemRepository.existsByIdAndRoomId(roomItemId, roomId)) {
            throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND, Map.of("resource", "roomItem"));
        }

        ItemLock candidate = new ItemLock(
                participantId,
                nickname,
                request.data().lockToken(),
                System.currentTimeMillis()
        );
        ItemLock current = locks.compute(new LockKey(roomId, roomItemId), (key, existing) -> {
            boolean replaceable = existing == null
                    || isExpired(existing)
                    || existing.participantId().equals(participantId);
            return replaceable ? candidate : existing;
        });

        return new ItemLockResult(current == candidate, room.getVersion(), current);
    }

    private boolean isExpired(ItemLock lock) {
        return System.currentTimeMillis() - lock.lockedAtMillis() > lockTtlMillis;
    }

    private void validateRequest(ItemLockRequestDTO request) {
        if (request == null
                || request.data() == null
                || request.data().roomItemId() == null
                || request.data().lockToken() == null
                || request.data().lockToken().isBlank()) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
    }

    private void validateActive(Room room) {
        boolean expired = !room.getExpiresAt().isAfter(LocalDateTime.now(AppZone.KST));
        boolean closedStatus = "FINISHED".equals(room.getStatus())
                || "CLOSED".equals(room.getStatus());
        if (expired || closedStatus) {
            throw new ApiException(ErrorCode.ROOM_CLOSED);
        }
    }
}
