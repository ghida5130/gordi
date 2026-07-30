package com.ssafy.backend.dto.recommendation;

import com.ssafy.backend.config.RecommendationPolicy;
import com.ssafy.backend.config.enums.CategoryCode;
import com.ssafy.backend.config.enums.MoodCode;
import com.ssafy.backend.config.enums.SubcategoryCode;

import java.util.Arrays;
import java.util.List;

// 추천 옵션 조회 응답 (카테고리·세부 분류·무드·예산 정책)
public record RecommendationOptionsResponse(
        List<CategoryOption> categories,
        List<MoodOption> moods,
        BudgetPolicy budgetPolicy,
        int recommendationResultCount,
        String schemaVersion
) {

    public static RecommendationOptionsResponse from(RecommendationPolicy policy) {
        List<CategoryOption> categories = Arrays.stream(CategoryCode.values())
                .map(CategoryOption::from)
                .toList();

        List<MoodOption> moods = Arrays.stream(MoodCode.values())
                .map(MoodOption::from)
                .toList();

        return new RecommendationOptionsResponse(
                categories,
                moods,
                BudgetPolicy.from(policy),
                policy.getResultCount(),
                policy.getSchemaVersion()
        );
    }

    public record CategoryOption(
            String code,
            String label,
            List<SubcategoryOption> subcategories
    ) {

        static CategoryOption from(CategoryCode category) {
            return new CategoryOption(
                    category.getCode(),
                    category.getLabel(),
                    category.getSubcategories().stream()
                            .map(SubcategoryOption::from)
                            .toList()
            );
        }
    }

    public record SubcategoryOption(String code, String label) {

        static SubcategoryOption from(SubcategoryCode subcategory) {
            return new SubcategoryOption(subcategory.getCode(), subcategory.getLabel());
        }
    }

    public record MoodOption(String code, String label) {

        static MoodOption from(MoodCode mood) {
            return new MoodOption(mood.getCode(), mood.getLabel());
        }
    }

    public record BudgetPolicy(
            int minAllowed,
            int maxAllowed,
            String currency,
            int step
    ) {

        static BudgetPolicy from(RecommendationPolicy policy) {
            return new BudgetPolicy(
                    policy.getBudgetMinAllowed(),
                    policy.getBudgetMaxAllowed(),
                    policy.getCurrency(),
                    policy.getBudgetStep()
            );
        }
    }
}
