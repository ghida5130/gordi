package com.ssafy.backend.common.aop;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.common.error.RequestIdUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BusinessOperationAspectTest {

    private final Logger logger = (Logger) LoggerFactory.getLogger(BusinessOperationAspect.class);
    private final ListAppender<ILoggingEvent> appender = new ListAppender<>();
    private Level originalLevel;
    private SampleService service;

    @BeforeEach
    void setUp() {
        originalLevel = logger.getLevel();
        logger.setLevel(Level.INFO);
        appender.start();
        logger.addAppender(appender);

        AspectJProxyFactory factory = new AspectJProxyFactory(new SampleService());
        factory.addAspect(new BusinessOperationAspect());
        service = factory.getProxy();
    }

    @AfterEach
    void tearDown() {
        RequestContextHolder.resetRequestAttributes();
        logger.detachAppender(appender);
        logger.setLevel(originalLevel);
        appender.stop();
    }

    @Test
    void successLogContainsTraceMetadataButNotArgumentsOrReturnValue() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(RequestIdUtils.REQUEST_ID_HEADER, "request-123");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        assertThat(service.success("secret-token")).isEqualTo("sensitive-result");

        ILoggingEvent event = appender.list.getFirst();
        assertThat(event.getLevel()).isEqualTo(Level.INFO);
        assertThat(event.getFormattedMessage())
                .contains("businessOperation=test.success")
                .contains("outcome=SUCCESS")
                .contains("requestId=request-123")
                .contains("target=SampleService.success")
                .doesNotContain("secret-token")
                .doesNotContain("sensitive-result");
    }

    @Test
    void domainFailureIsLoggedWithErrorCodeAndRethrown() {
        assertThatThrownBy(service::domainFailure)
                .isInstanceOf(ApiException.class);

        ILoggingEvent event = appender.list.getFirst();
        assertThat(event.getLevel()).isEqualTo(Level.WARN);
        assertThat(event.getFormattedMessage())
                .contains("businessOperation=test.failure")
                .contains("outcome=FAILURE")
                .contains("errorCode=BAD_REQUEST");
    }

    @Test
    void slowSuccessUsesWarningLevel() {
        service.slowSuccess();

        ILoggingEvent event = appender.list.getFirst();
        assertThat(event.getLevel()).isEqualTo(Level.WARN);
        assertThat(event.getFormattedMessage())
                .contains("businessOperation=test.slow")
                .contains("slow=true");
    }

    static class SampleService {

        @BusinessOperation(value = "test.success", slowThresholdMs = Long.MAX_VALUE)
        public String success(String secret) {
            return "sensitive-result";
        }

        @BusinessOperation("test.failure")
        public void domainFailure() {
            throw new ApiException(ErrorCode.BAD_REQUEST);
        }

        @BusinessOperation(value = "test.slow", slowThresholdMs = 0)
        public void slowSuccess() {
        }
    }
}
