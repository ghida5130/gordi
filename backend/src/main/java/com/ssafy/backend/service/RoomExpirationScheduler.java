package com.ssafy.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConditionalOnProperty(
        name = "room.expiration-cleanup.enabled",
        havingValue = "true",
        matchIfMissing = true
)
public class RoomExpirationScheduler {

    private static final Logger log = LoggerFactory.getLogger(RoomExpirationScheduler.class);

    private final RoomExpirationService roomExpirationService;
    private final int batchSize;

    public RoomExpirationScheduler(
            RoomExpirationService roomExpirationService,
            @Value("${room.expiration-cleanup.batch-size:100}") int batchSize
    ) {
        if (batchSize <= 0) {
            throw new IllegalArgumentException("room.expiration-cleanup.batch-size는 0보다 커야 합니다.");
        }
        this.roomExpirationService = roomExpirationService;
        this.batchSize = batchSize;
    }

    @Scheduled(
            fixedDelayString = "${room.expiration-cleanup.interval-ms:10000}",
            initialDelayString = "${room.expiration-cleanup.interval-ms:10000}"
    )
    public void expireDueRooms() {
        List<Long> dueRoomIds = roomExpirationService.findDueRoomIds(batchSize);
        if (dueRoomIds.isEmpty()) {
            return;
        }

        int expired = 0;
        for (Long roomId : dueRoomIds) {
            try {
                if (roomExpirationService.expire(roomId)) {
                    expired++;
                }
            } catch (Exception exception) {
                log.warn(
                        "Room expiration failed for one room. roomId={}, exceptionType={}",
                        roomId,
                        exception.getClass().getName()
                );
            }
        }

        log.info("Room expiration finished. checked={}, expired={}", dueRoomIds.size(), expired);
    }
}
