package com.ssafy.backend.common.aop;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.RequestIdUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.concurrent.TimeUnit;

/** 핵심 비즈니스 작업의 처리 결과와 실행 시간을 일관된 형식으로 기록한다. */
@Aspect
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 100)
public class BusinessOperationAspect {

    private static final Logger log = LoggerFactory.getLogger(BusinessOperationAspect.class);
    private static final String NO_REQUEST_ID = "-";

    @Around("@annotation(operation)")
    public Object trace(
            ProceedingJoinPoint joinPoint,
            BusinessOperation operation
    ) throws Throwable {
        long startedAt = System.nanoTime();
        String requestId = currentRequestId();
        String target = targetName(joinPoint);

        try {
            Object result = joinPoint.proceed();
            long durationMs = elapsedMillis(startedAt);
            logSuccess(operation, target, requestId, durationMs);
            return result;
        } catch (Throwable throwable) {
            long durationMs = elapsedMillis(startedAt);
            logFailure(operation, target, requestId, durationMs, throwable);
            throw throwable;
        }
    }

    private void logSuccess(
            BusinessOperation operation,
            String target,
            String requestId,
            long durationMs
    ) {
        if (durationMs >= operation.slowThresholdMs()) {
            log.warn(
                    "businessOperation={} outcome=SUCCESS durationMs={} requestId={} target={} slow=true",
                    operation.value(), durationMs, requestId, target
            );
            return;
        }

        log.info(
                "businessOperation={} outcome=SUCCESS durationMs={} requestId={} target={} slow=false",
                operation.value(), durationMs, requestId, target
        );
    }

    private void logFailure(
            BusinessOperation operation,
            String target,
            String requestId,
            long durationMs,
            Throwable throwable
    ) {
        if (throwable instanceof ApiException apiException) {
            log.warn(
                    "businessOperation={} outcome=FAILURE durationMs={} requestId={} target={} errorCode={}",
                    operation.value(), durationMs, requestId, target,
                    apiException.getErrorCode().getCode()
            );
            return;
        }

        log.error(
                "businessOperation={} outcome=FAILURE durationMs={} requestId={} target={} exceptionType={}",
                operation.value(), durationMs, requestId, target, throwable.getClass().getName()
        );
    }

    private long elapsedMillis(long startedAt) {
        return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
    }

    private String targetName(ProceedingJoinPoint joinPoint) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        return signature.getDeclaringType().getSimpleName() + "." + signature.getName();
    }

    private String currentRequestId() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        if (attributes instanceof ServletRequestAttributes servletAttributes) {
            HttpServletRequest request = servletAttributes.getRequest();
            return RequestIdUtils.resolve(request);
        }
        return NO_REQUEST_ID;
    }
}
