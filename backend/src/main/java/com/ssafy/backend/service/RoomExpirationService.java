package com.ssafy.backend.service;

import com.ssafy.backend.common.time.AppZone;
import com.ssafy.backend.domain.Room;
import com.ssafy.backend.repository.RoomRepository;
import com.ssafy.backend.websocket.event.RoomExpiredEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RoomExpirationService {

    private static final String WAITING = "WAITING";
    private static final String IN_PROGRESS = "IN_PROGRESS";
    private static final String EXPIRED = "EXPIRED";

    private final RoomRepository roomRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public List<Long> findDueRoomIds(int batchSize) {
        return roomRepository.findDueRoomIds(
                LocalDateTime.now(AppZone.KST),
                PageRequest.of(0, batchSize)
        );
    }

    /**
     * 만료 대상 방 하나를 잠근 뒤 EXPIRED로 전이한다.
     * 여러 서버가 동시에 실행해도 먼저 잠금을 얻어 전이한 서버만 이벤트를 발행한다.
     */
    @Transactional
    public boolean expire(Long roomId) {
        Room room = roomRepository.findByIdForUpdate(roomId).orElse(null);
        if (room == null || !isDue(room, LocalDateTime.now(AppZone.KST))) {
            return false;
        }

        room.setStatus(EXPIRED);
        Room expiredRoom = roomRepository.saveAndFlush(room);
        eventPublisher.publishEvent(new RoomExpiredEvent(
                expiredRoom.getId(),
                expiredRoom.getVersion()
        ));
        return true;
    }

    private boolean isDue(Room room, LocalDateTime now) {
        boolean expirableStatus = WAITING.equals(room.getStatus())
                || IN_PROGRESS.equals(room.getStatus());
        return expirableStatus
                && room.getExpiresAt() != null
                && !room.getExpiresAt().isAfter(now);
    }
}
