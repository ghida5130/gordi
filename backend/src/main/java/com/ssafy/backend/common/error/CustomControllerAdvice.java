package com.ssafy.backend.common.error;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// 컨트롤러 실행 과정에서 발생한 예외 처리
@RestControllerAdvice
public class CustomControllerAdvice {

    private static final Logger log = LoggerFactory.getLogger(CustomControllerAdvice.class);

    // 비즈니스 오류
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApiException(
            ApiException exception,
            HttpServletRequest request
    ) {
        return buildResponse(
                exception.getErrorCode(),
                exception.getMessage(),
                exception.getDetails(),
                request
        );
    }

    // Validation 오류
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleMethodArgumentNotValid(
            MethodArgumentNotValidException exception,
            HttpServletRequest request
    ) {
        List<Map<String, Object>> fields = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(this::toFieldDetail)
                .toList();

        return buildResponse(
                ErrorCode.BAD_REQUEST,
                "요청 값 검증에 실패했습니다.",
                Map.of("fields", fields),
                request
        );
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(
            ConstraintViolationException exception,
            HttpServletRequest request
    ) {
        List<Map<String, Object>> fields = exception.getConstraintViolations()
                .stream()
                .map(this::toConstraintDetail)
                .toList();

        return buildResponse(
                ErrorCode.BAD_REQUEST,
                "요청 값 검증에 실패했습니다.",
                Map.of("fields", fields),
                request
        );
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleMessageNotReadable(
            HttpMessageNotReadableException exception,
            HttpServletRequest request
    ) {
        return buildResponse(
                ErrorCode.BAD_REQUEST,
                "요청 본문을 읽을 수 없습니다.",
                Map.of(),
                request
        );
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(
            AccessDeniedException exception,
            HttpServletRequest request
    ) {
        return buildResponse(ErrorCode.FORBIDDEN, ErrorCode.FORBIDDEN.getMessage(), Map.of(), request);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthentication(
            AuthenticationException exception,
            HttpServletRequest request
    ) {
        return buildResponse(ErrorCode.UNAUTHORIZED, ErrorCode.UNAUTHORIZED.getMessage(), Map.of(), request);
    }

    @ExceptionHandler(UsernameNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleUsernameNotFound(
            UsernameNotFoundException exception,
            HttpServletRequest request
    ) {
        return buildResponse(ErrorCode.RESOURCE_NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND.getMessage(), Map.of(), request);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResourceFound(
            NoResourceFoundException exception,
            HttpServletRequest request
    ) {
        return buildResponse(
                ErrorCode.RESOURCE_NOT_FOUND,
                ErrorCode.RESOURCE_NOT_FOUND.getMessage(),
                Map.of("path", exception.getResourcePath()),
                request
        );
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotSupported(
            HttpRequestMethodNotSupportedException exception,
            HttpServletRequest request
    ) {
        return buildResponse(
                ErrorCode.METHOD_NOT_ALLOWED,
                ErrorCode.METHOD_NOT_ALLOWED.getMessage(),
                Map.of("method", exception.getMethod()),
                request
        );
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMediaTypeNotSupported(
            HttpMediaTypeNotSupportedException exception,
            HttpServletRequest request
    ) {
        return buildResponse(
                ErrorCode.UNSUPPORTED_MEDIA_TYPE,
                ErrorCode.UNSUPPORTED_MEDIA_TYPE.getMessage(),
                Map.of("contentType", String.valueOf(exception.getContentType())),
                request
        );
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUploadSizeExceeded(
            MaxUploadSizeExceededException exception,
            HttpServletRequest request
    ) {
        return buildResponse(ErrorCode.CONTENT_TOO_LARGE, ErrorCode.CONTENT_TOO_LARGE.getMessage(), Map.of(), request);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(
            DataIntegrityViolationException exception,
            HttpServletRequest request
    ) {
        return buildResponse(ErrorCode.CONFLICT, ErrorCode.CONFLICT.getMessage(), Map.of(), request);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(
            IllegalArgumentException exception,
            HttpServletRequest request
    ) {
        return buildResponse(ErrorCode.BAD_REQUEST, exception.getMessage(), Map.of(), request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpectedException(
            Exception exception,
            HttpServletRequest request
    ) {
        String requestId = RequestIdUtils.resolve(request);
        log.error(
                "Unhandled exception. requestId={}, exceptionType={}",
                requestId,
                exception.getClass().getName()
        );
        return buildResponse(
                ErrorCode.INTERNAL_SERVER_ERROR,
                ErrorCode.INTERNAL_SERVER_ERROR.getMessage(),
                Map.of(),
                request
        );
    }

    private ResponseEntity<ErrorResponse> buildResponse(
            ErrorCode errorCode,
            String message,
            Map<String, Object> details,
            HttpServletRequest request
    ) {
        String requestId = RequestIdUtils.resolve(request);
        ErrorResponse body = ErrorResponse.of(errorCode, message, details, requestId);

        return ResponseEntity.status(errorCode.getStatus())
                .header(RequestIdUtils.REQUEST_ID_HEADER, requestId)
                .body(body);
    }

    private Map<String, Object> toFieldDetail(FieldError error) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("field", error.getField());
        detail.put("message", error.getDefaultMessage());
        if (error.getRejectedValue() != null) {
            detail.put("rejectedValue", error.getRejectedValue());
        }
        return detail;
    }

    private Map<String, Object> toConstraintDetail(ConstraintViolation<?> violation) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("field", violation.getPropertyPath().toString());
        detail.put("message", violation.getMessage());
        if (violation.getInvalidValue() != null) {
            detail.put("rejectedValue", violation.getInvalidValue());
        }
        return detail;
    }
}
