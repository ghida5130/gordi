package com.ssafy.backend.recommendation.domain;

// 세부 분류 코드 (추천 옵션 조회의 단일 출처)
public enum SubcategoryCode {

    SHORT_SLEEVE("반팔"),
    LONG_SLEEVE("긴팔"),
    SHIRT("셔츠"),
    KNIT("니트"),
    HOODIE("후드/맨투맨"),

    DENIM_PANTS("데님 팬츠"),
    SLACKS("슬랙스"),
    SHORTS("반바지"),
    SKIRT("스커트"),

    JACKET("재킷"),
    COAT("코트"),
    CARDIGAN("가디건"),
    PADDING("패딩"),

    SNEAKERS("스니커즈"),
    BOOTS("부츠"),
    LOAFER("로퍼"),
    SANDALS("샌들");

    private final String label;

    SubcategoryCode(String label) {
        this.label = label;
    }

    public String getCode() {
        return name();
    }

    public String getLabel() {
        return label;
    }
}
