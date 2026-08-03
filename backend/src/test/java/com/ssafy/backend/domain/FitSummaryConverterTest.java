package com.ssafy.backend.domain;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FitSummaryConverterTest {

    private final FitSummaryConverter converter = new FitSummaryConverter();

    @Test
    void 문구_목록은_JSON_배열로_저장된다() {
        String stored = converter.convertToDatabaseColumn(List.of("여유로운 상의 핏", "기본 기장"));

        assertThat(stored).isNotNull();
        assertThat(converter.convertToEntityAttribute(stored))
                .containsExactly("여유로운 상의 핏", "기본 기장");
    }

    @Test
    void 빈_목록과_null은_컬럼에_저장하지_않는다() {
        assertThat(converter.convertToDatabaseColumn(List.of())).isNull();
        assertThat(converter.convertToDatabaseColumn(null)).isNull();
    }

    @Test
    void 저장값이_없으면_빈_목록으로_복원된다() {
        assertThat(converter.convertToEntityAttribute(null)).isEmpty();
        assertThat(converter.convertToEntityAttribute("   ")).isEmpty();
    }

    @Test
    void 깨진_JSON은_조회를_실패시키지_않고_빈_목록이_된다() {
        assertThat(converter.convertToEntityAttribute("{ not json array")).isEmpty();
    }

    @Test
    void 배열_안의_null은_제외된다() {
        assertThat(converter.convertToEntityAttribute("[\"핏\", null]")).containsExactly("핏");
    }
}
