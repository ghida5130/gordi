package com.ssafy.backend.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.ObjectMapper;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;

/**
 * 핏 설명 문구 목록을 JSON 배열 문자열 컬럼에 저장한다.
 * <p>
 * 콜백 수신·정합 복구·조회 세 경로가 모두 같은 변환을 필요로 하므로 여기에 모아 둔다.
 * 저장된 값이 깨져 있어도 조회를 실패시키지 않고 빈 목록으로 복원한다.
 */
@Converter
public class FitSummaryConverter implements AttributeConverter<List<String>, String> {

    private static final Logger log = LoggerFactory.getLogger(FitSummaryConverter.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Override
    public String convertToDatabaseColumn(List<String> attribute) {
        if (attribute == null || attribute.isEmpty()) {
            return null;
        }
        try {
            return OBJECT_MAPPER.writeValueAsString(attribute);
        } catch (Exception exception) {
            log.warn("fitSummary could not be serialized. exceptionType={}", exception.getClass().getName());
            return null;
        }
    }

    @Override
    public List<String> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return List.of();
        }
        try {
            String[] values = OBJECT_MAPPER.readValue(dbData, String[].class);
            return Arrays.stream(values).filter(Objects::nonNull).toList();
        } catch (Exception exception) {
            log.warn("Stored fitSummary could not be parsed. exceptionType={}", exception.getClass().getName());
            return List.of();
        }
    }
}
