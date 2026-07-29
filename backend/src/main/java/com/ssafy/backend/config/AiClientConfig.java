package com.ssafy.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

// FastAPI 내부 호출용 RestClient
@Configuration
public class AiClientConfig {

    @Bean
    public RestClient aiRestClient(
            @Value("${gordi.ai.base-url:http://localhost:8000}") String baseUrl,
            @Value("${gordi.ai.connect-timeout-ms:2000}") long connectTimeoutMs,
            @Value("${gordi.ai.read-timeout-ms:5000}") long readTimeoutMs
    ) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(connectTimeoutMs));
        requestFactory.setReadTimeout(Duration.ofMillis(readTimeoutMs));

        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
    }
}
