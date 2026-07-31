package com.ssafy.backend.config.enums;

import java.util.Locale;
import java.util.Optional;

public enum GenderCode {

    MALE,
    FEMALE,
    UNISEX;

    public static Optional<GenderCode> find(String code) {
        if (code == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(valueOf(code.strip().toUpperCase(Locale.ROOT)));
        } catch (IllegalArgumentException exception) {
            return Optional.empty();
        }
    }
}
