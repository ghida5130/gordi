package com.ssafy.backend.config.enums;

import java.util.Optional;

/**
 * 아바타 키 구간. {@code Avatar.heightId} 가 가리키는 실제 cm 범위이며,
 * 착장 생성 요청에 minHeight / maxHeight 로 전달된다.
 */
public enum HeightRange {

    H140_150(1L, 140, 150),
    H150_160(2L, 150, 160),
    H160_170(3L, 160, 170),
    H170_180(4L, 170, 180),
    H180_190(5L, 180, 190);

    private final Long heightId;
    private final int minHeight;
    private final int maxHeight;

    HeightRange(Long heightId, int minHeight, int maxHeight) {
        this.heightId = heightId;
        this.minHeight = minHeight;
        this.maxHeight = maxHeight;
    }

    // 정의되지 않은 id(미입력 0 등)는 빈 값
    public static Optional<HeightRange> find(Long heightId) {
        if (heightId == null) {
            return Optional.empty();
        }
        for (HeightRange range : values()) {
            if (range.heightId.equals(heightId)) {
                return Optional.of(range);
            }
        }
        return Optional.empty();
    }

    public Long getHeightId() {
        return heightId;
    }

    public int getMinHeight() {
        return minHeight;
    }

    public int getMaxHeight() {
        return maxHeight;
    }
}
