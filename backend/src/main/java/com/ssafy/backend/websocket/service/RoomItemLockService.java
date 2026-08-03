package com.ssafy.backend.websocket.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.repository.RoomItemRepository;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.websocket.RoomEventPublisher;
import com.ssafy.backend.websocket.dto.ItemLockRequestDTO;
import com.ssafy.backend.websocket.dto.ItemUnlockRequestDTO;
import com.ssafy.backend.websocket.dto.ItemUnlockedEventDataDTO;
import com.ssafy.backend.websocket.dto.RoomEventDTO;
import com.ssafy.backend.websocket.event.ItemUnlockReason;
import com.ssafy.backend.websocket.event.ItemUnlockRequestedEvent;
import com.ssafy.backend.websocket.event.ParticipantLeftEvent;
import com.ssafy.backend.websocket.event.RoomEventType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

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
    private final RoomEventPublisher roomEventPublisher;
    private final long lockTtlMillis;

    public RoomItemLockService(
            RoomRepository roomRepository,
            RoomItemRepository roomItemRepository,
            RoomEventPublisher roomEventPublisher,
            @Value("${room.item-lock-ttl:30000}") long lockTtlMillis
    ) {
        this.roomRepository = roomRepository;
        this.roomItemRepository = roomItemRepository;
        this.roomEventPublisher = roomEventPublisher;
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

    // - 인자: 방 ID, 요청자 participantId, 해제 요청(roomItemId/lockToken/reason)
    // - 동작: 소유자·토큰이 일치할 때만 잠금을 해제하고 ITEM_UNLOCKED를 방 토픽으로 방송.
    //         (버전 증가 없음, 방송 reason은 요청의 reason 그대로. 기본값 RELEASED)
    //         불일치(늦게 도착한 이전 드래그의 unlock 등)는 해제·방송 없이 false 반환
    public boolean unlock(Long roomId, Long participantId, ItemUnlockRequestDTO request) {
        validateUnlockRequest(request);

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ApiException(ErrorCode.ROOM_NOT_FOUND));

        boolean released = releaseIfOwnedBy(
                roomId,
                request.data().roomItemId(),
                participantId,
                request.data().lockToken()
        );
        if (!released) {
            return false;
        }

        ItemUnlockReason reason = request.data().reason() == null
                ? ItemUnlockReason.RELEASED
                : request.data().reason();
        roomEventPublisher.publish(RoomEventDTO.of(
                RoomEventType.ITEM_UNLOCKED,
                request.clientEventId(),
                roomId,
                room.getVersion(),
                participantId,
                new ItemUnlockedEventDataDTO(request.data().roomItemId(), reason)
        ));
        return true;
    }

    private void validateUnlockRequest(ItemUnlockRequestDTO request) {
        if (request == null
                || request.data() == null
                || request.data().roomItemId() == null
                || request.data().lockToken() == null
                || request.data().lockToken().isBlank()) {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }
    }

    // - 인자: 이동 커밋 후 발행되는 잠금 해제 요청 이벤트
    // - 동작: 소유자·토큰이 일치하면 잠금을 제거하고 ITEM_UNLOCKED를 방 토픽으로 브로드캐스트.
    //         (TTL 만료로 이미 다른 참여자가 잠금을 가져간 경우엔 해제·방송하지 않는다)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleUnlockRequested(ItemUnlockRequestedEvent event) {
        boolean released = releaseIfOwnedBy(
                event.roomId(),
                event.roomItemId(),
                event.senderParticipantId(),
                event.lockToken()
        );
        if (!released) {
            return;
        }
        roomEventPublisher.publish(RoomEventDTO.of(
                RoomEventType.ITEM_UNLOCKED,
                event.clientEventId(),
                event.roomId(),
                event.roomVersion(),
                event.senderParticipantId(),
                new ItemUnlockedEventDataDTO(event.roomItemId(), event.reason())
        ));
    }

    // - 인자: 방/아이템 ID, 해제 요청자 participantId, 잠금 토큰
    // - 동작: 현재 잠금의 소유자와 토큰이 모두 일치할 때만 원자적으로 제거. 제거 여부 반환
    public boolean releaseIfOwnedBy(Long roomId, Long roomItemId, Long participantId, String lockToken) {
        AtomicBoolean released = new AtomicBoolean(false);
        locks.computeIfPresent(new LockKey(roomId, roomItemId), (key, existing) -> {
            if (existing.participantId().equals(participantId)
                    && existing.lockToken().equals(lockToken)) {
                released.set(true);
                return null; // 엔트리 제거
            }
            return existing;
        });
        return released.get();
    }

    // - 인자: 방/참가자 ID
    // - 동작: 참가자가 보유한 해당 방의 모든 휘발성 잠금을 제거하고 제거 개수를 반환한다.
    public int releaseAllOwnedBy(Long roomId, Long participantId) {
        AtomicInteger released = new AtomicInteger();
        locks.forEach((key, existing) -> {
            if (key.roomId().equals(roomId)
                    && existing.participantId().equals(participantId)
                    && locks.remove(key, existing)) {
                released.incrementAndGet();
            }
        });
        return released.get();
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleParticipantLeft(ParticipantLeftEvent event) {
        releaseAllOwnedBy(event.roomId(), event.participantId());
    }

    // - 인자: 방/아이템 ID, 확인 주체 participantId
    // - 동작: 다른 참여자가 만료되지 않은 잠금을 보유 중인지 여부 반환
    public boolean isLockedByOther(Long roomId, Long roomItemId, Long participantId) {
        ItemLock lock = locks.get(new LockKey(roomId, roomItemId));
        return lock != null
                && !isExpired(lock)
                && !lock.participantId().equals(participantId);
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
