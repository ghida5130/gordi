package com.ssafy.backend.config.enums;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** 명세서의 키·몸무게 구간 표와 enum 이 일치하는지 확인한다. */
class BodyRangeTest {

    @Test
    void 키_구간_표와_일치한다() {
        assertThat(HeightRange.find(1L)).get()
                .extracting(HeightRange::getMinHeight, HeightRange::getMaxHeight)
                .containsExactly(140, 150);
        assertThat(HeightRange.find(3L)).get()
                .extracting(HeightRange::getMinHeight, HeightRange::getMaxHeight)
                .containsExactly(160, 170);
        assertThat(HeightRange.find(5L)).get()
                .extracting(HeightRange::getMinHeight, HeightRange::getMaxHeight)
                .containsExactly(180, 190);
    }

    @Test
    void 몸무게_구간_표와_일치한다() {
        assertThat(WeightRange.find(1L)).get()
                .extracting(WeightRange::getMinWeight, WeightRange::getMaxWeight)
                .containsExactly(40, 50);
        assertThat(WeightRange.find(3L)).get()
                .extracting(WeightRange::getMinWeight, WeightRange::getMaxWeight)
                .containsExactly(60, 70);
        assertThat(WeightRange.find(5L)).get()
                .extracting(WeightRange::getMinWeight, WeightRange::getMaxWeight)
                .containsExactly(80, 90);
    }

    @Test
    void 미입력_0과_범위_밖_id는_빈_값이다() {
        assertThat(HeightRange.find(0L)).isEmpty();
        assertThat(HeightRange.find(6L)).isEmpty();
        assertThat(HeightRange.find(null)).isEmpty();
        assertThat(WeightRange.find(0L)).isEmpty();
        assertThat(WeightRange.find(6L)).isEmpty();
        assertThat(WeightRange.find(null)).isEmpty();
    }

    @Test
    void 구간은_다섯_개씩_정의돼_있다() {
        assertThat(HeightRange.values()).hasSize(5);
        assertThat(WeightRange.values()).hasSize(5);
    }
}
