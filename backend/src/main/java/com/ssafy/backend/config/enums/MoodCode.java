package com.ssafy.backend.config.enums;

import java.util.Optional;

// 무드 코드 (추천 옵션 조회의 단일 출처)
public enum MoodCode {

    CASUAL("캐주얼"),
    MINIMAL("미니멀"),
    STREET("스트릿"),
    CLASSIC("클래식"),
    SPORTY("스포티"),
    ROMANTIC("로맨틱");

    private final String label;

    MoodCode(String label) {
        this.label = label;
    }

    public static Optional<MoodCode> find(String code) {
        if (code == null) {
            return Optional.empty();
        }
        for (MoodCode mood : values()) {
            if (mood.name().equals(code)) {
                return Optional.of(mood);
            }
        }
        return Optional.empty();
    }

    public String getCode() {
        return name();
    }

    public String getLabel() {
        return label;
    }
}
