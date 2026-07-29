package com.ssafy.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

// 추천 정책 단일 출처 (프론트엔드는 이 값을 조회해서 사용하고 하드코딩하지 않는다)
@Component
public class RecommendationPolicy {

    private final int budgetMinAllowed;
    private final int budgetMaxAllowed;
    private final String currency;
    private final int budgetStep;
    private final int resultCount;
    private final int candidatePoolSize;
    private final String schemaVersion;

    public RecommendationPolicy(
            @Value("${gordi.recommendation.budget.min-allowed:0}") int budgetMinAllowed,
            @Value("${gordi.recommendation.budget.max-allowed:5000000}") int budgetMaxAllowed,
            @Value("${gordi.recommendation.budget.currency:KRW}") String currency,
            @Value("${gordi.recommendation.budget.step:10000}") int budgetStep,
            @Value("${gordi.recommendation.result-count:12}") int resultCount,
            @Value("${gordi.recommendation.candidate-pool-size:200}") int candidatePoolSize,
            @Value("${gordi.recommendation.schema-version:2.0}") String schemaVersion
    ) {
        this.budgetMinAllowed = budgetMinAllowed;
        this.budgetMaxAllowed = budgetMaxAllowed;
        this.currency = currency;
        this.budgetStep = budgetStep;
        this.resultCount = resultCount;
        this.candidatePoolSize = candidatePoolSize;
        this.schemaVersion = schemaVersion;
    }

    public int getBudgetMinAllowed() {
        return budgetMinAllowed;
    }

    public int getBudgetMaxAllowed() {
        return budgetMaxAllowed;
    }

    public String getCurrency() {
        return currency;
    }

    public int getBudgetStep() {
        return budgetStep;
    }

    public int getResultCount() {
        return resultCount;
    }

    // FastAPI 로 넘길 후보 상품 상한 (전체 스캔 방지)
    public int getCandidatePoolSize() {
        return candidatePoolSize;
    }

    public String getSchemaVersion() {
        return schemaVersion;
    }

    // 예산이 정책 허용 범위 안인지 확인
    public boolean isBudgetWithinPolicy(int budgetMin, int budgetMax) {
        return budgetMin >= budgetMinAllowed && budgetMax <= budgetMaxAllowed;
    }
}
