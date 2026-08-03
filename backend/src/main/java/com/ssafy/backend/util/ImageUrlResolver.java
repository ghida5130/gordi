package com.ssafy.backend.util;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 응답에 포함되는 이미지 URL을 절대 URL로 변환하는 전역 리졸버.
 *
 * <p>DB에 상대 경로(예: {@code /images/product/1.jpg})로 저장된 imageUrl 앞에
 * CDN 베이스 URL({@code gordi.image.base-url}, .env의 {@code BASE_URL})을 붙인다.
 * 이미 절대 URL(http/https/data:)이거나 베이스 URL이 비어 있으면 그대로 반환한다.
 */
@Component
public class ImageUrlResolver {

    private final String baseUrl;

    public ImageUrlResolver(@Value("${gordi.image.base-url:}") String baseUrl) {
        this.baseUrl = stripTrailingSlash(baseUrl);
    }

    /** 상대 경로면 베이스 URL을 붙여 절대 URL로 변환한다. null/공백/절대 URL은 그대로 반환. */
    public String resolve(String url) {
        if (url == null || url.isBlank() || baseUrl.isEmpty()) {
            return url;
        }
        String trimmed = url.trim();
        if (trimmed.startsWith("http://")
                || trimmed.startsWith("https://")
                || trimmed.startsWith("data:")
                || trimmed.startsWith("//")) {
            return url;
        }
        return trimmed.startsWith("/") ? baseUrl + trimmed : baseUrl + "/" + trimmed;
    }

    private static String stripTrailingSlash(String value) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        return trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
    }
}
