# Backend Service
본 프로젝트의 백엔드 서비스 파트입니다.

## 테스트 설명
* 이 파일의 변경사항은 GitLab Webhook을 통해 Jenkins로 전달됩니다.
* Target Branch: `main`
* Trigger Path: `backend/**`

## 로컬 실행 가이드
1. DB 실행
```bash
docker compose up -d
```
2. backend 재빌드
```bash
docker compose -f docker-compose.local.yml up -d --build
```
- 도커 파일 실행을 통해 Jar 파일을 생성합니다.
- 이상 있으면 ```docker compose -f docker-compose.local.yml down```을 통해 다시 내렸다가 재빌드

## 응답 처리 가이드

### 1. 공통 성공 응답

컨트롤러에서 반환할 DTO 또는 값을 `ApiResponse.success()`로 감쌉니다.

```java
@GetMapping
public ApiResponse<UserResponseDTO> getUser() {
    UserResponseDTO dto = userService.readUser();
    return ApiResponse.success(dto);
}
```

`success()`는 성공 여부를 판단하거나 HTTP 상태를 설정하지 않습니다. 전달받은 값을 `data`에 넣어 `ApiResponse`로 감싸는 편의 메서드이며 `new ApiResponse<>(dto)`와 같은 역할입니다.

```json
{
  "data": {
    "loginId": "gordi",
    "nickname": "홍길동"
  }
}
```

#### HTTP 상태별 반환 방법

| 상황 | HTTP 상태 | 반환 방법 |
|---|---:|---|
| 조회·일반 수정 성공 | `200 OK` | `ApiResponse.success(data)` |
| 회원가입·방 등 리소스 생성 | `201 Created` | `ResponseEntity.status(CREATED).body(...)` |
| 비동기 Job 접수 | `202 Accepted` | `ResponseEntity.status(ACCEPTED).body(...)` |
| 반환할 본문이 없는 성공 | `204 No Content` | `ResponseEntity.noContent().build()` |

새 리소스를 생성할 때는 `ResponseEntity`로 HTTP 상태를 직접 지정합니다.

```java
@PostMapping
public ResponseEntity<ApiResponse<UserResponseDTO>> createUser() {
    UserResponseDTO dto = userService.createUser();

    return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(ApiResponse.success(dto));
}
```

`ApiResponse.success(dto)`만 반환하는 경우와 위 코드의 JSON 본문은 동일합니다. 차이는 기본 `200 OK` 대신 `201 Created`를 명시했다는 점입니다.

```json
{
  "data": {
    "loginId": "gordi",
    "nickname": "홍길동"
  }
}
```

본문이 없는 `204 No Content`는 `ApiResponse`로 감싸지 않습니다.

```java
@DeleteMapping("/{userId}")
public ResponseEntity<Void> deleteUser(@PathVariable Long userId) {
    userService.deleteUser(userId);
    return ResponseEntity.noContent().build();
}
```

### 2. 공통 오류 응답

오류 응답은 `ErrorResponse` 형식으로 통일합니다.

```json
{
  "code": "ROOM_NOT_FOUND",
  "message": "방을 찾을 수 없습니다.",
  "details": {
    "roomId": 31
  },
  "requestId": "request-uuid",
  "retryable": false
}
```

- `code`: 클라이언트가 분기 처리할 에러 코드
- `message`: 사용자에게 보여줄 수 있는 안전한 메시지
- `details`: 필드명, 현재 버전 등 오류 해결에 필요한 추가 정보
- `requestId`: 클라이언트 오류와 서버 로그를 연결하는 추적 ID
- `retryable`: 동일 요청을 다시 시도할 수 있는지 여부

컨트롤러에서 오류 JSON이나 `ResponseEntity.badRequest()`를 직접 만들지 않습니다. 예상 가능한 오류는 Service에서 `ApiException`으로 발생시키고 `CustomControllerAdvice`가 공통 오류 응답으로 변환하도록 합니다.

### 3. `ApiException` 사용

`ApiException`은 Service에서 발생한 예상 가능한 오류의 `ErrorCode`와 `details`를 `CustomControllerAdvice`로 전달하는 `RuntimeException`입니다.

```text
Service
  → ApiException
  → CustomControllerAdvice
  → ErrorResponse
```

예상 가능한 비즈니스 오류의 예시는 다음과 같습니다.

- 존재하지 않는 방
- 이미 사용 중인 닉네임
- 방 인원 초과
- 버전 충돌
- 재시도할 수 없는 Job

먼저 `ErrorCode.java`에서 사용할 코드를 확인합니다. 필요한 코드가 없다면 HTTP 상태, 기본 메시지, 재시도 가능 여부를 함께 정의합니다.

다음 코드는 새 에러 코드를 추가하는 예시입니다.

```java
LOGIN_ID_ALREADY_EXISTS(
        HttpStatus.CONFLICT,
        "이미 사용 중인 아이디입니다.",
        false
),
```

Service에서는 해당 코드로 `ApiException`을 발생시킵니다.

```java
if (userRepository.existsByLoginId(loginId)) {
    throw new ApiException(
            ErrorCode.LOGIN_ID_ALREADY_EXISTS,
            Map.of("field", "loginId")
    );
}
```

가능하면 `ErrorCode`의 기본 메시지를 사용하고, `details`에는 클라이언트가 오류를 해결하는 데 필요한 안전한 정보만 넣습니다.

### 4. 요청값 검증 오류

단순한 필드 형식 검증은 Service에서 직접 검사하지 않고 DTO Validation을 사용합니다.

```java
public record RecommendationRequest(
        @NotNull Long budgetMin,
        @NotNull Long budgetMax,
        @Size(min = 1, max = 5) List<String> moods
) {
}
```

```java
@PostMapping
public ResponseEntity<ApiResponse<RecommendationResponse>> create(
        @Valid @RequestBody RecommendationRequest request
) {
    RecommendationResponse result = recommendationService.create(request);

    return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(ApiResponse.success(result));
}
```

Validation 실패 시 Spring이 `MethodArgumentNotValidException`을 발생시키고 `CustomControllerAdvice`가 `400 BAD_REQUEST`로 변환합니다.

따라서 컨트롤러에서 다음처럼 직접 처리하지 않습니다.

```java
// 사용하지 않음
if (request.budgetMin() == null) {
    return ResponseEntity.badRequest().build();
}
```

두 필드의 관계처럼 단일 Annotation으로 표현하기 어려운 규칙은 Service 또는 커스텀 Validator에서 검증합니다.

```java
if (budgetMin > budgetMax) {
    throw new ApiException(
            ErrorCode.INVALID_BUDGET_RANGE,
            Map.of("field", "budgetMin")
    );
}
```

Validation 응답의 `details`에도 비밀번호, 토큰과 같은 민감한 `rejectedValue`를 포함하지 않습니다.

### 5. 리소스 조회 실패

`Optional.get()`이나 일반 `RuntimeException`, `IllegalArgumentException`을 비즈니스 오류에 사용하지 않습니다.

```java
Room room = roomRepository.findById(roomId)
        .orElseThrow(() -> new ApiException(
                ErrorCode.ROOM_NOT_FOUND,
                Map.of("roomId", roomId)
        ));
```

### 6. 인증·권한 오류

Security 필터는 컨트롤러보다 먼저 실행되므로 `CustomControllerAdvice`가 처리할 수 없습니다. 이 영역에서는 `ApiErrorResponseWriter`를 사용해 동일한 `ErrorResponse` 형식으로 직접 응답합니다.

```java
errorResponseWriter.write(
        request,
        response,
        ErrorCode.INVALID_TOKEN
);
```

적용 대상은 다음과 같습니다.

- `JWTFilter`
- 로그인 실패 Handler
- `AuthenticationEntryPoint`
- `AccessDeniedHandler`
- 로그아웃 Handler의 오류 처리
- 향후 추가되는 Security Filter

`LoginSuccessHandler`는 오류 처리 대상이 아닙니다. 로그인 성공 결과는 `ApiResponse.success()`로 반환합니다.

Security 필터에서 다음과 같이 JSON 문자열을 직접 작성하지 않습니다.

```java
// 사용하지 않음
response.getWriter().write(
        "{\"message\":\"토큰이 만료되었습니다.\"}"
);
```

### 7. 외부 API·AI 서비스 오류

외부 서비스의 오류 원문을 클라이언트에 그대로 반환하지 않습니다.

```java
try {
    aiClient.requestTryOn(request);
} catch (TimeoutException exception) {
    throw new ApiException(
            ErrorCode.DEPENDENCY_UNAVAILABLE,
            Map.of("dependency", "AI_SERVER")
    );
}
```

```json
{
  "code": "DEPENDENCY_UNAVAILABLE",
  "message": "외부 의존 서비스를 사용할 수 없습니다.",
  "details": {
    "dependency": "AI_SERVER"
  },
  "requestId": "...",
  "retryable": true
}
```

클라이언트 응답에는 다음 정보를 포함하지 않습니다.

- Access/Refresh Token
- 비밀번호
- API Key
- 외부 공급자 오류 원문
- SQL
- 스택 트레이스
- 전체 사용자 Prompt
- 이미지 Base64

서버 로그에는 `requestId`와 함께 예외를 기록할 수 있지만, 토큰·비밀번호·API Key·개인정보 등 민감정보는 기록하지 않습니다.

### 8. 새 API 구현 체크리스트

- 성공 응답을 `ApiResponse.success(data)`로 감쌌는가?
- 생성은 `201`, 비동기 접수는 `202`, 본문 없음은 `204`를 사용했는가?
- 예상 가능한 오류에 적절한 `ErrorCode`를 사용했는가?
- 컨트롤러에서 오류 응답을 직접 만들거나 예외를 `try-catch`하지 않았는가?
- 비즈니스 오류에 일반 `RuntimeException`이나 `IllegalArgumentException`을 사용하지 않았는가?
- Security 필터 오류에 `ApiErrorResponseWriter`를 사용했는가?
- `details`와 로그에 비밀번호·토큰 등 민감정보가 포함되지 않았는가?
- 에러 코드와 HTTP 상태를 테스트로 검증했는가?
>>>>>>> be/feat/login
