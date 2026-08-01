package com.ssafy.backend.config.enums;

import java.util.Optional;

/**
 * 아바타 몸무게 구간. {@code Avatar.weightId} 가 가리키는 실제 kg 범위이며,
 * 착장 생성 요청에 minWeight / maxWeight 로 전달된다.
 */
public enum WeightRange {

    W40_50(1L, 40, 50),
    W50_60(2L, 50, 60),
    W60_70(3L, 60, 70),
    W70_80(4L, 70, 80),
    W80_90(5L, 80, 90);

    private final Long weightId;
    private final int minWeight;
    private final int maxWeight;

    WeightRange(Long weightId, int minWeight, int maxWeight) {
        this.weightId = weightId;
        this.minWeight = minWeight;
        this.maxWeight = maxWeight;
    }

    // 정의되지 않은 id(미입력 0 등)는 빈 값
    public static Optional<WeightRange> find(Long weightId) {
        if (weightId == null) {
            return Optional.empty();
        }
        for (WeightRange range : values()) {
            if (range.weightId.equals(weightId)) {
                return Optional.of(range);
            }
        }
        return Optional.empty();
    }

    public Long getWeightId() {
        return weightId;
    }

    public int getMinWeight() {
        return minWeight;
    }

    public int getMaxWeight() {
        return maxWeight;
    }
}
