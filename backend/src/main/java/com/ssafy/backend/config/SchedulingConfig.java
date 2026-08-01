package com.ssafy.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

// 주기 실행 활성화 (착장 Job 정합 복구)
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
