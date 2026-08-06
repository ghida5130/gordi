# 백엔드 AOP 적용 설계

> 작성일: 2026-08-06 · 브랜치: `be/test/aop` · 상태: **설계 검토 대기** (검토 후 구현 진행)

## 1. 배경 및 현황

`com.ssafy.backend` 모듈을 전수 조사한 결과, 현재 AOP는 전혀 사용되지 않고 있으며(`@Aspect` 0건, `spring-boot-starter-aop` 미선언) 핵심 기능에 다음과 같은 횡단 관심사(cross-cutting concern) 공백/중복이 있다.

| 문제 | 근거 |
|---|---|
| **추천·착장 생성 플로우에 로깅이 전무** | `RecommendationService`(632줄) 로그 0건, `TryOnService`(897줄)는 Logger 필드만 선언하고 미사용(L79). 컨트롤러도 로그 0건 |
| **외부 AI 호출 지연시간 미측정** | `RecommendationRankClient.rank()`, `TryOnGenerationRestClient.submit()/fetchStatus()` — 시스템에서 가장 느린 구간인데 성공 로그·타이밍 없음. 실패 시 `log.error`만 존재 |
| **멱등성 처리 코드 수동 중복 (~70줄)** | `hashRequest → findReplay → (조기 return) → remember` 3단 프로토콜이 `RecommendationService.createSnapshot/replaceItems`, `TryOnService.create/retry`에 복사-붙여넣기 |
| **요청 추적 불가 (MDC 없음)** | `RequestIdUtils`로 X-Request-ID를 만들지만 에러 응답 헤더·try-on 클라이언트 전파 3곳에서만 소비. 일반 로그 라인과 연결 안 됨 |
| **비즈니스 예외가 로그에 남지 않음** | `CustomControllerAdvice`는 최후 fallback(`Exception`)에서만 `log.error`. `ApiException`(409 충돌, 503 등)은 어디에도 기록 안 됨 |
| **방 접근 검증 수동 호출 12곳** | `roomAccessValidator.requireParticipant(...)`가 서비스 메서드 첫 줄에 반복 |

## 2. 설계 목표 / 비목표

**목표**
1. 추천·착장 생성 플로우의 **관측 가능성 확보**: 진입/종료/소요시간/실패를 요청 ID로 상관관계 추적 가능하게.
2. 외부 AI 호출(FastAPI) **지연시간·성공률 측정**.
3. 멱등성 프로토콜을 **어노테이션 선언형**으로 전환해 중복 제거.
4. 비즈니스 로직 코드에서 인프라 관심사를 걷어내 서비스 메서드를 짧게.

**비목표 (이번 범위 제외)**
- 재시도/서킷브레이커(Resilience4j) 도입 — 별도 설계 필요.
- 방 접근 검증(`RoomAccessValidator`)의 어노테이션화 — 검증기가 `RoomParticipant`를 **반환**하고 호출자가 그 객체를 사용하므로, 단순 가드 AOP로는 안 되고 request-scoped holder가 필요함. 복잡도 대비 이득이 작아 후순위(§8 참고).
- STOMP(websocket) 컨트롤러의 예외 처리 통일 — Spring AOP가 아니라 `@MessageExceptionHandler` 도입이 정도(正道)이므로 별도 작업.

## 3. 전체 구조

```
com.ssafy.backend
├── common
│   ├── aop                       ← 신규 패키지
│   │   ├── LogExecution.java         (@interface) 실행 로깅 대상 표시
│   │   ├── Idempotent.java           (@interface) 멱등성 적용 표시
│   │   ├── ExecutionLogAspect.java   서비스 실행 로깅/타이밍
│   │   ├── ExternalApiLogAspect.java 외부 AI 호출 로깅/타이밍
│   │   ├── IdempotencyAspect.java    멱등성 replay/remember
│   │   └── IdempotencyKeyHolder.java (request-scoped) 헤더 전달용
│   └── error
│       └── (기존) CustomControllerAdvice ← ApiException 로깅 추가
├── filter
│   └── RequestIdMdcFilter.java   ← 신규 (AOP 아님, 기반 인프라)
└── resources
    └── logback-spring.xml        ← 신규 (%X{requestId} 패턴)
```

의존성 추가 (build.gradle):

```groovy
implementation 'org.springframework.boot:spring-boot-starter-aop'
```

> `spring-aop`/`aspectj`는 이미 `data-jpa` 스타터를 통해 클래스패스에 있으므로 starter 선언은 명시성 확보 차원. `@EnableAspectJAutoProxy`는 Spring Boot 자동구성이 처리하므로 불필요.

### 3.1 Aspect 순서 (중요)

`@Transactional` 인터셉터(기본 `Ordered.LOWEST_PRECEDENCE`)와의 순서를 명시적으로 고정한다.

```
요청 → [ExecutionLogAspect @Order(100)]
        → [IdempotencyAspect @Order(200)]
           → [@Transactional 프록시 (LOWEST_PRECEDENCE)]
              → 실제 서비스 메서드
```

- **ExecutionLogAspect가 가장 바깥**: 트랜잭션 커밋/롤백 시간까지 포함한 총 소요시간을 측정하고, 롤백으로 끝난 실패도 기록.
- **IdempotencyAspect가 트랜잭션 바깥**: replay 히트 시 트랜잭션을 아예 열지 않고 저장된 응답을 반환(현재 수동 코드는 트랜잭션 안에서 replay 체크 — 개선점). 단, `remember`는 대상 메서드 성공 후 실행되므로 자체 트랜잭션(`IdempotencyService`가 repository save 시 암묵 트랜잭션)으로 커밋된다. 대상 메서드 트랜잭션 커밋 → remember 사이에 서버가 죽으면 기록이 누락되는데, 이는 **현재 수동 구현과 동일한 보장 수준**이므로 회귀 아님.

### 3.2 프록시 제약 (설계 전제)

Spring AOP는 프록시 기반이므로:
- **self-invocation(내부 호출)은 인터셉트 안 됨.** 예: `RecommendationService.createSnapshot()` 내부에서 부르는 `pickReplacements()`(private)는 어드바이스 대상이 아님. → 어노테이션은 **컨트롤러가 직접 호출하는 public 진입 메서드에만** 붙인다.
- private 메서드 불가, final 클래스/메서드 불가 — 현재 대상 클래스들은 모두 해당 없음.

## 4. Aspect 상세 설계

### 4.1 기반: RequestIdMdcFilter + logback (AOP 아님, 선행 필수)

모든 로깅 aspect의 출력이 요청 단위로 묶이려면 MDC가 먼저 있어야 한다.

```java
// filter/RequestIdMdcFilter.java — OncePerRequestFilter
protected void doFilterInternal(req, res, chain) {
    String requestId = RequestIdUtils.resolve(req);   // 기존 유틸 재사용 (인바운드 헤더 존중, 없으면 UUID)
    MDC.put("requestId", requestId);
    res.setHeader(RequestIdUtils.REQUEST_ID_HEADER, requestId); // 성공 응답에도 헤더 부여
    try { chain.doFilter(req, res); }
    finally { MDC.remove("requestId"); }
}
```

- 등록: `SecurityConfig`에서 `JWTFilter`보다 **앞에**(`addFilterBefore`) 배치해 인증 실패 로그에도 requestId가 찍히게 한다.
- `logback-spring.xml` 콘솔 패턴에 `[%X{requestId:-}]` 추가. 기존 Spring Boot 기본 패턴을 유지하면서 requestId만 삽입.
- 효과: 기존 `CustomControllerAdvice`/`ApiErrorResponseWriter`의 수동 헤더 세팅과 중복되지만 해롭지 않음(같은 값). 정리는 구현 시 선택.

### 4.2 ExecutionLogAspect — 서비스 실행 로깅/타이밍

**대상 지정 방식: 커스텀 어노테이션 `@LogExecution`** (패키지 포인트컷이 아닌 opt-in).
이유: `service..*` 전체를 포인트컷으로 잡으면 `JwtService`·`RoomAccessValidator`처럼 요청당 수십 번 불리는 빈까지 로그가 폭발한다. 주요 기능에만 명시적으로 붙이는 게 이 코드베이스 규모에 맞음.

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface LogExecution {
    String value() default "";        // 로그에 쓸 작업명 (미지정 시 클래스.메서드명)
    long slowThresholdMs() default 3000; // 초과 시 WARN
}
```

```java
@Aspect @Order(100) @Component
public class ExecutionLogAspect {
    @Around("@annotation(logExecution)")
    public Object around(ProceedingJoinPoint pjp, LogExecution logExecution) throws Throwable {
        String op = resolveName(pjp, logExecution);
        long start = System.currentTimeMillis();
        log.info("[{}] 시작", op);
        try {
            Object result = pjp.proceed();
            long elapsed = System.currentTimeMillis() - start;
            if (elapsed >= logExecution.slowThresholdMs()) {
                log.warn("[{}] 완료(느림). elapsedMs={}", op, elapsed);
            } else {
                log.info("[{}] 완료. elapsedMs={}", op, elapsed);
            }
            return result;
        } catch (ApiException e) {
            log.warn("[{}] 실패. elapsedMs={}, errorCode={}, details={}",
                    op, System.currentTimeMillis() - start, e.getErrorCode(), e.getDetails());
            throw e;
        } catch (Throwable e) {
            log.error("[{}] 예기치 못한 실패. elapsedMs={}", op, System.currentTimeMillis() - start, e);
            throw e;
        }
    }
}
```

설계 결정:
- **파라미터 값은 로그에 남기지 않는다** (기본). 요청 DTO에 신체 정보 등 민감값이 있을 수 있고, 실패 시 상세는 `ApiException.details`와 ControllerAdvice가 담당. 필요해지면 어노테이션에 `logArgs` 플래그를 추가하는 확장 여지만 둔다.
- `ApiException`은 **WARN**(예상된 비즈니스 실패), 그 외는 **ERROR + 스택트레이스**. 현재 코드베이스의 `exception.getClass().getName()`만 남기는 관례는 원인 추적이 안 되므로 aspect에서는 스택트레이스를 넘긴다.
- 로그 메시지는 기존 하우스 스타일(한국어 메시지 + `key=value` 접미) 유지.

**적용 대상 (1차):**

| 클래스 | 메서드 | 작업명 |
|---|---|---|
| `RecommendationService` | `createSnapshot` | `추천 생성` |
| `RecommendationService` | `replaceItems` | `추천 아이템 교체` |
| `TryOnService` | `create` | `착장 생성 요청` |
| `TryOnService` | `retry` | `착장 재생성 요청` |
| `TryOnService` | `confirmSnapshot` | `착장 확정` |
| `TryOnJobEventService` | `apply` | `착장 잡 이벤트 수신` |
| `TryOnJobReconciliationService` | `reconcile` | `착장 잡 복구` |

조회성 메서드(`readSnapshot`, `read`, `readOptions`)는 1차 제외 — 노이즈 대비 가치 낮음. 필요 시 어노테이션만 붙이면 되는 구조.

### 4.3 ExternalApiLogAspect — 외부 AI 호출 측정

**대상 지정 방식: 패키지 포인트컷.** `infra` 패키지는 외부 호출 전용이라는 컨벤션이 이미 있으므로(백엔드작업가이드 명시) 어노테이션 없이 일괄 적용이 적절.

```java
@Aspect @Order(150) @Component
public class ExternalApiLogAspect {
    @Around("execution(public * com.ssafy.backend.infra..*(..))")
    public Object around(ProceedingJoinPoint pjp) throws Throwable {
        String target = pjp.getSignature().getDeclaringType().getSimpleName()
                + "." + pjp.getSignature().getName();
        long start = System.currentTimeMillis();
        try {
            Object result = pjp.proceed();
            log.info("외부 API 호출 성공. target={}, elapsedMs={}", target, System.currentTimeMillis() - start);
            return result;
        } catch (Throwable e) {
            log.warn("외부 API 호출 실패. target={}, elapsedMs={}, exceptionType={}",
                    target, System.currentTimeMillis() - start, e.getClass().getName());
            throw e;  // 상세 error 로그는 클라이언트 내부의 기존 log.error가 담당 (중복 방지 위해 여기선 warn)
        }
    }
}
```

- 커버 대상: `RecommendationRankClient.rank`, `TryOnGenerationRestClient.submit/fetchStatus` (인터페이스 `TryOnGenerationClient` 경유 호출도 프록시로 커버됨).
- 기존 클라이언트 내부 `log.error`(요청 컨텍스트 포함)는 유지 — aspect는 타이밍/성공 기록이 주 목적.
- 부수 효과: 조사에서 발견된 **`RecommendationRankClient`의 X-Request-ID 미전파**는 AOP 범위가 아니므로 구현 시 별도 1줄 수정으로 함께 처리 권장 (try-on 클라이언트와 동일하게).

### 4.4 IdempotencyAspect — 멱등성 선언형 전환

가장 효과가 크지만 가장 신중해야 하는 부분. 현재 수동 프로토콜의 제약을 모두 보존해야 한다.

**보존해야 할 기존 동작(회귀 방지 체크리스트):**
1. `Idempotency-Key` 헤더가 공백/null이면 멱등성 스킵 (그냥 실행).
2. 게스트(비회원)면 스킵 — `IdempotencyRecord.userId`가 NOT NULL이므로 (`TryOnService` L669).
3. 같은 키 + 같은 endpoint + 같은 requestHash → 저장된 응답 replay.
4. 같은 키인데 endpoint/hash 불일치 → `ApiException(IDEMPOTENCY_KEY_REUSED)`.
5. 직렬화/역직렬화 실패 시 `log.warn` 후 통과 (fail-open).
6. `recommendationId/Version` NOT NULL 제약 — try-on은 `NO_RECOMMENDATION = 0L` 센티널 사용.

**설계:**

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Idempotent {
    String endpoint();  // 예: "POST /api/v1/recommendations"
}
```

```java
@Aspect @Order(200) @Component
public class IdempotencyAspect {
    // 흐름:
    // 1. IdempotencyKeyHolder(request-scoped)에서 키 조회 → 공백이면 pjp.proceed()
    // 2. SecurityContext에서 userId 해석 → 게스트면 pjp.proceed()
    // 3. hashSource = 대상 메서드가 제공하는 해시 재료 → requestHash 계산
    // 4. findReplay 히트 → 저장된 응답 반환 (proceed 안 함)
    // 5. proceed() 성공 → remember(응답)
}
```

**핵심 설계 결정 두 가지:**

**(a) 키 전달 — request-scoped holder.**
현재는 컨트롤러가 `@RequestHeader("Idempotency-Key")`로 받아 서비스 파라미터로 넘긴다. 어노테이션 방식에서는 aspect가 헤더를 직접 읽어야 하므로, `HandlerInterceptor` 또는 filter에서 헤더를 `IdempotencyKeyHolder`(@RequestScope 빈)에 담고 aspect가 꺼낸다. 이렇게 하면 **서비스 메서드 시그니처에서 `idempotencyKey` 파라미터가 사라진다** (컨트롤러 4곳, 서비스 4곳 시그니처 정리).

**(b) requestHash 재료 — 서비스별 커스텀 유지.**
현재 해시 재료는 단순 파라미터 직렬화가 아니라 도메인 지식이 들어간 정규화 값이다(예: `TryOnService.hashJobRequest`는 정렬된 itemIds + wearOptions + avatarVersion 조합, L760). 이를 aspect가 일반화하면 의미가 깨진다. → **해시 계산은 대상 메서드 쪽 책임으로 남기되**, `Idempotent` 어노테이션이 붙은 메서드의 **특정 파라미터를 SpEL로 지정**하는 방식과, **`IdempotencyHashSource` 인터페이스를 요청 DTO가 구현**하는 방식 중 후자를 채택:

```java
public interface IdempotencyHashSource {
    Object[] idempotencyHashParts();   // 정규화된 해시 재료
}
```

단, `TryOnService`의 해시 재료는 DTO 밖의 값(avatarVersion 등 DB 조회 결과)을 포함하므로 DTO 단독으로는 못 만든다. → **절충안**: 멱등성 replay 판정 기준을 "정규화 요청 본문"으로 통일하고, DB 상태 의존 재료(avatarVersion)는 해시에서 제외한다. 이는 **동작 변화**다: 같은 요청 본문 + 아바타만 갱신된 재요청이 기존에는 새 잡을 만들었지만, 변경 후에는 replay된다. 멱등성 키의 원래 의미(같은 요청의 중복 방지)에는 부합하지만, **이 변화를 수용할지가 검토 포인트 #1** (§7). 수용 불가 시 fallback: `TryOnService`의 create/retry는 수동 구현을 유지하고 `RecommendationService` 2곳만 aspect 적용.

### 4.5 CustomControllerAdvice 보강 (AOP 아님, 소규모)

`ApiException` 핸들러에 로그 한 줄 추가:

```java
log.warn("API 예외 응답. requestId={}, code={}, status={}, details={}", ...)
```

ExecutionLogAspect가 붙지 않은 나머지 엔드포인트(방, 후보군 등)의 비즈니스 실패도 최소한 기록되게 하는 안전망. 5xx 계열 ErrorCode는 `log.error`로 분기.

## 5. 구현 단계 (검토 승인 후)

| 단계 | 내용 | 리스크 | 예상 변경 |
|---|---|---|---|
| **1. 기반** | starter-aop 의존성, `RequestIdMdcFilter`, `logback-spring.xml`, ControllerAdvice 로그 | 낮음 (동작 무변경) | 신규 2파일 + 2파일 수정 |
| **2. 로깅 aspect** | `@LogExecution` + `ExecutionLogAspect` + `ExternalApiLogAspect`, 대상 7개 메서드에 어노테이션 | 낮음 (로그만 추가) | 신규 3파일 + 대상 4파일에 어노테이션 |
| **3. 멱등성 aspect** | `@Idempotent` + holder + aspect, `RecommendationService` 2곳 우선 전환 → 검증 후 `TryOnService` 전환 여부 결정 | **중간** (동작 보존 필요, §7 검토 포인트) | 신규 4파일 + 서비스/컨트롤러 시그니처 정리 |

각 단계는 독립 커밋/독립 배포 가능. 3단계는 1·2단계와 무관하게 보류 가능.

## 6. 테스트 전략

- **ExecutionLogAspect**: 슬라이스 테스트 — `@SpringBootTest` 없이 `AspectJProxyFactory`로 프록시 생성해 정상/ApiException/느림(threshold 초과) 3케이스에서 로그 레벨·예외 재전파 검증. Logback `ListAppender`로 로그 캡처.
- **IdempotencyAspect**: 기존 수동 구현의 6가지 동작(§4.4 체크리스트)을 그대로 옮긴 통합 테스트(H2). 특히 "키 재사용 + hash 불일치 → 409", "게스트 스킵", "replay 시 DB에 새 스냅샷 미생성"을 필수 검증.
- **회귀**: 기존 `RecommendationService`/`TryOnService` 테스트가 있다면 시그니처 변경(idempotencyKey 파라미터 제거) 반영 후 전체 통과 확인.
- **프록시 함정 검증**: `@LogExecution`이 붙은 메서드를 같은 클래스 내부에서 호출하는 경로가 없는지 구현 시 확인 (현재 대상 7개 메서드는 모두 컨트롤러/스케줄러에서 직접 호출됨 — 확인 완료).

## 7. 검토 포인트 (구현 전 결정 필요)

1. **[멱등성 해시 의미 변화]** §4.4(b) — try-on 해시에서 `avatarVersion` 등 DB 상태를 제외하는 변경을 수용할지. **미수용 시 TryOnService는 수동 구현 유지** (aspect는 추천 2곳만).
2. **[로그 언어]** aspect 로그를 기존 websocket 컨트롤러처럼 한국어로 갈지, 영어로 갈지. 설계는 한국어(하우스 스타일) 기준.
3. **[적용 범위]** 1차 대상 7개 메서드(§4.2 표)에 추가/제외할 메서드가 있는지.
4. **[조회 API 로깅]** read 계열을 제외한 결정이 맞는지 (트래픽 대비 노이즈 관점).

## 8. 후순위 과제 (이번 범위 외, 기록만)

- `@RequireRoomParticipant`/`@RequireHost` 어노테이션화 — request-scoped participant holder 필요, 12개 호출부.
- 스케줄러 루프 패턴(catch-log-continue) 공통화 — AOP보다 템플릿 메서드/유틸이 적합.
- STOMP `@MessageExceptionHandler` 도입 — websocket 컨트롤러 5곳의 중복 가드 제거.
- `TryOnService.create/retry`에서 **외부 HTTP 호출이 트랜잭션 안에서 실행되는 문제** — AI 서버가 느리면 DB 커넥션 점유. AOP와 무관하지만 조사 중 발견된 사항으로, `@TransactionalEventListener(AFTER_COMMIT)` 기반 제출로 바꾸는 별도 리팩터링 후보.
- Resilience4j(재시도/서킷브레이커), Micrometer 지표(`@Timed`) — 관측 고도화 다음 단계.
