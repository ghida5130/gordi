package com.ssafy.backend.common.time;

import java.time.ZoneId;

/**
 * 애플리케이션 표준 시간대.
 * DB 커넥션(serverTimezone=Asia/Seoul) 및 @CreationTimestamp가 사용하는 기준과 동일하게 맞춘다.
 * LocalDateTime 컬럼을 다룰 때는 반드시 이 상수를 사용할 것.
 */
public final class AppZone {

    public static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private AppZone() {
    }
}
