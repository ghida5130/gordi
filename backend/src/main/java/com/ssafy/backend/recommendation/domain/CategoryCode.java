package com.ssafy.backend.recommendation.domain;

import java.util.List;
import java.util.Optional;

// 카테고리 코드와 허용 세부 분류 (추천 옵션 조회의 단일 출처)
public enum CategoryCode {

    TOP("상의", List.of(
            SubcategoryCode.SHORT_SLEEVE,
            SubcategoryCode.LONG_SLEEVE,
            SubcategoryCode.SHIRT,
            SubcategoryCode.KNIT,
            SubcategoryCode.HOODIE
    )),
    BOTTOM("하의", List.of(
            SubcategoryCode.DENIM_PANTS,
            SubcategoryCode.SLACKS,
            SubcategoryCode.SHORTS,
            SubcategoryCode.SKIRT
    )),
    OUTER("아우터", List.of(
            SubcategoryCode.JACKET,
            SubcategoryCode.COAT,
            SubcategoryCode.CARDIGAN,
            SubcategoryCode.PADDING
    )),
    SHOES("신발", List.of(
            SubcategoryCode.SNEAKERS,
            SubcategoryCode.BOOTS,
            SubcategoryCode.LOAFER,
            SubcategoryCode.SANDALS
    ));

    private final String label;
    private final List<SubcategoryCode> subcategories;

    CategoryCode(String label, List<SubcategoryCode> subcategories) {
        this.label = label;
        this.subcategories = subcategories;
    }

    public static Optional<CategoryCode> find(String code) {
        if (code == null) {
            return Optional.empty();
        }
        for (CategoryCode category : values()) {
            if (category.name().equals(code)) {
                return Optional.of(category);
            }
        }
        return Optional.empty();
    }

    public String getCode() {
        return name();
    }

    public String getLabel() {
        return label;
    }

    public List<SubcategoryCode> getSubcategories() {
        return subcategories;
    }

    // 세부 분류가 이 카테고리에 속하는지 검증
    public boolean supports(String subcategoryCode) {
        for (SubcategoryCode subcategory : subcategories) {
            if (subcategory.name().equals(subcategoryCode)) {
                return true;
            }
        }
        return false;
    }
}
