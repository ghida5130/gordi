package com.ssafy.backend.common.response;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ApiResponseTest {

    @Test
    void successWrapsPayloadWithData() {
        ApiResponse<Map<String, Long>> response = ApiResponse.success(Map.of("userId", 1L));

        assertThat(response.data()).containsEntry("userId", 1L);
    }
}
