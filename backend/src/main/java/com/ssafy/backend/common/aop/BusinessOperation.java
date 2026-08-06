package com.ssafy.backend.common.aop;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** 운영에서 추적할 핵심 비즈니스 작업을 표시한다. */
@Documented
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface BusinessOperation {

    String value();

    long slowThresholdMs() default 1_000L;
}
