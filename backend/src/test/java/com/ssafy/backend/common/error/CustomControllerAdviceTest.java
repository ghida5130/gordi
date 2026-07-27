package com.ssafy.backend.common.error;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.access.AccessDeniedException;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CustomControllerAdviceTest {

    private final CustomControllerAdvice advice = new CustomControllerAdvice();

    @Test
    void apiExceptionUsesCommonErrorContract() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(RequestIdUtils.REQUEST_ID_HEADER, "request-123");
        ApiException exception = new ApiException(
                ErrorCode.INVALID_BUDGET_RANGE,
                Map.of("field", "budgetMin")
        );

        ResponseEntity<ErrorResponse> response = advice.handleApiException(exception, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getHeaders().getFirst(RequestIdUtils.REQUEST_ID_HEADER)).isEqualTo("request-123");
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo("INVALID_BUDGET_RANGE");
        assertThat(response.getBody().details()).containsEntry("field", "budgetMin");
        assertThat(response.getBody().requestId()).isEqualTo("request-123");
        assertThat(response.getBody().retryable()).isFalse();
    }

    @Test
    void accessDeniedUsesForbiddenCode() {
        MockHttpServletRequest request = new MockHttpServletRequest();

        ResponseEntity<ErrorResponse> response = advice.handleAccessDenied(
                new AccessDeniedException("internal security detail"),
                request
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo("FORBIDDEN");
        assertThat(response.getBody().message()).isEqualTo(ErrorCode.FORBIDDEN.getMessage());
        assertThat(response.getBody().requestId()).isNotBlank();
    }

    @Test
    void unexpectedExceptionDoesNotExposeInternalMessage() {
        MockHttpServletRequest request = new MockHttpServletRequest();

        ResponseEntity<ErrorResponse> response = advice.handleUnexpectedException(
                new RuntimeException("database password must not be exposed"),
                request
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo("INTERNAL_SERVER_ERROR");
        assertThat(response.getBody().message())
                .isEqualTo(ErrorCode.INTERNAL_SERVER_ERROR.getMessage())
                .doesNotContain("password");
    }
}
