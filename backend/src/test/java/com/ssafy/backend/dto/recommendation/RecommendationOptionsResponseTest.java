package com.ssafy.backend.dto.recommendation;

import com.ssafy.backend.config.RecommendationPolicy;
import com.ssafy.backend.config.enums.CategoryCode;
import com.ssafy.backend.config.enums.MoodCode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RecommendationOptionsResponseTest {

    private final RecommendationPolicy policy =
            new RecommendationPolicy(0, 5_000_000, "KRW", 10_000, 12, 200, "2.0");

    @Test
    void optionsExposeEveryCategoryWithItsSubcategories() {
        RecommendationOptionsResponse response = RecommendationOptionsResponse.from(policy);

        assertThat(response.categories()).hasSize(CategoryCode.values().length);

        RecommendationOptionsResponse.CategoryOption top = response.categories().stream()
                .filter(category -> category.code().equals("TOP"))
                .findFirst()
                .orElseThrow();

        assertThat(top.label()).isEqualTo("상의");
        assertThat(top.subcategories())
                .extracting(RecommendationOptionsResponse.SubcategoryOption::code)
                .contains("SHORT_SLEEVE", "LONG_SLEEVE");
    }

    @Test
    void optionsExposeMoodsAndBudgetPolicy() {
        RecommendationOptionsResponse response = RecommendationOptionsResponse.from(policy);

        assertThat(response.moods()).hasSize(MoodCode.values().length);
        assertThat(response.moods())
                .extracting(RecommendationOptionsResponse.MoodOption::code)
                .contains("CASUAL", "MINIMAL");

        assertThat(response.budgetPolicy().minAllowed()).isZero();
        assertThat(response.budgetPolicy().maxAllowed()).isEqualTo(5_000_000);
        assertThat(response.budgetPolicy().currency()).isEqualTo("KRW");
        assertThat(response.budgetPolicy().step()).isEqualTo(10_000);
    }

    // 프론트엔드가 추천 개수를 하드코딩하지 않도록 서버 정책을 그대로 노출한다
    @Test
    void optionsExposeResultCountAndSchemaVersion() {
        RecommendationOptionsResponse response = RecommendationOptionsResponse.from(policy);

        assertThat(response.recommendationResultCount()).isEqualTo(12);
        assertThat(response.schemaVersion()).isEqualTo("2.0");
    }

    @Test
    void categoryRejectsSubcategoryFromAnotherCategory() {
        assertThat(CategoryCode.TOP.supports("LONG_SLEEVE")).isTrue();
        assertThat(CategoryCode.TOP.supports("SLACKS")).isFalse();
        assertThat(CategoryCode.find("UNKNOWN")).isEmpty();
        assertThat(MoodCode.find("UNKNOWN")).isEmpty();
    }
}
