package com.ssafy.backend.dto.tryon;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class TryOnJobCreateRequestDTOTest {

    private static ValidatorFactory validatorFactory;
    private static Validator validator;

    @BeforeAll
    static void openValidator() {
        validatorFactory = Validation.buildDefaultValidatorFactory();
        validator = validatorFactory.getValidator();
    }

    @AfterAll
    static void closeValidator() {
        validatorFactory.close();
    }

    @Test
    void 정상_요청은_위반이_없다() {
        Set<ConstraintViolation<TryOnJobCreateRequestDTO>> violations = validator.validate(request(
                new TryOnJobCreateRequestDTO.Context("ROOM", "A7K9Q2", 17L),
                38L,
                List.of(new TryOnJobCreateRequestDTO.Item(91L, null, "TOP")),
                null
        ));

        assertThat(violations).isEmpty();
    }

    @Test
    void context가_없으면_위반이다() {
        Set<ConstraintViolation<TryOnJobCreateRequestDTO>> violations = validator.validate(request(
                null,
                38L,
                List.of(new TryOnJobCreateRequestDTO.Item(91L, null, "TOP")),
                null
        ));

        assertThat(violations)
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("context");
    }

    @Test
    void context_type이_비어있으면_위반이다() {
        Set<ConstraintViolation<TryOnJobCreateRequestDTO>> violations = validator.validate(request(
                new TryOnJobCreateRequestDTO.Context("  ", "A7K9Q2", 17L),
                38L,
                List.of(new TryOnJobCreateRequestDTO.Item(91L, null, "TOP")),
                null
        ));

        assertThat(violations)
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("context.type");
    }

    @Test
    void items가_비어있으면_위반이다() {
        Set<ConstraintViolation<TryOnJobCreateRequestDTO>> violations = validator.validate(request(
                new TryOnJobCreateRequestDTO.Context("SOLO", null, null),
                38L,
                List.of(),
                null
        ));

        assertThat(violations)
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("items");
    }

    @Test
    void item의_slot이_비어있으면_위반이다() {
        Set<ConstraintViolation<TryOnJobCreateRequestDTO>> violations = validator.validate(request(
                new TryOnJobCreateRequestDTO.Context("SOLO", null, null),
                38L,
                List.of(new TryOnJobCreateRequestDTO.Item(null, 500L, "")),
                null
        ));

        assertThat(violations)
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("items[0].slot");
    }

    @Test
    void avatarId가_양수가_아니면_위반이다() {
        Set<ConstraintViolation<TryOnJobCreateRequestDTO>> violations = validator.validate(request(
                new TryOnJobCreateRequestDTO.Context("SOLO", null, null),
                0L,
                List.of(new TryOnJobCreateRequestDTO.Item(null, 500L, "TOP")),
                null
        ));

        assertThat(violations)
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("avatarId");
    }

    @Test
    void prompt가_상한을_넘으면_위반이다() {
        Set<ConstraintViolation<TryOnJobCreateRequestDTO>> violations = validator.validate(request(
                new TryOnJobCreateRequestDTO.Context("SOLO", null, null),
                38L,
                List.of(new TryOnJobCreateRequestDTO.Item(null, 500L, "TOP")),
                "가".repeat(501)
        ));

        assertThat(violations)
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("prompt");
    }

    private TryOnJobCreateRequestDTO request(
            TryOnJobCreateRequestDTO.Context context,
            Long avatarId,
            List<TryOnJobCreateRequestDTO.Item> items,
            String prompt
    ) {
        return new TryOnJobCreateRequestDTO(context, avatarId, items, null, prompt);
    }
}
