# AI 의상 추천 CI/CD 환경 설정 가이드

작성일: 2026-07-31  
대상: 백엔드 및 CI/CD 담당자

## 1. 목적

FastAPI 의상 추천 서비스는 OpenRouter의 Gemini Embedding 2를 사용해 사용자
이미지·텍스트를 임베딩하고, 사전에 생성한 상품 카탈로그 인덱스에서 후보를
검색합니다.

이 문서는 Jenkins를 통한 EC2 배포에 필요한 환경변수, 임베딩 인덱스 배치 및
배포 후 확인 절차를 설명합니다.

## 2. Jenkins 환경변수 파일

현재 `Jenkinsfile`은 Jenkins Credential의 `backend-env-file`을 workspace
루트의 `.env`로 복사합니다.

```groovy
file(credentialsId: 'backend-env-file', variable: 'BACKEND_ENV_FILE')
```

따라서 아래 설정은 `backend-env-file` Credential에 추가합니다. 실제 비밀값은
Git, Jenkins 로그, 메신저 또는 문서에 기록하지 않습니다.

## 3. 필수 설정

```env
# OpenRouter API 인증
OPENROUTER_API_KEY=<OpenRouter API key>

# Spring Backend와 FastAPI 사이의 내부 API 인증
# Backend와 AI가 반드시 같은 값을 사용해야 합니다.
INTERNAL_API_KEY=<충분히 긴 임의의 비밀값>

# Backend 컨테이너에서 FastAPI 컨테이너에 접근하는 주소
AI_INTERNAL_BASE_URL=http://gordi-ai:8000

# EC2에 영구 보관할 카탈로그 인덱스 디렉터리
CATALOG_EMBEDDING_INDEX_HOST_DIR=/opt/gordi/ai/catalog_index
```

`OPENROUTER_API_KEY`는 OpenRouter 호출에 필요한 유일한 외부 API 비밀값입니다.
기존 `GEMINI_API_KEY`는 사용하지 않습니다.

`INTERNAL_API_KEY`가 비어 있으면 FastAPI 내부 API 인증이 생략되므로 운영
환경에서는 반드시 설정해야 합니다.

## 4. 권장 설정

```env
OPENROUTER_EMBEDDING_MODEL=google/gemini-embedding-2
OPENROUTER_EMBEDDING_DIMENSIONS=768
OPENROUTER_EMBEDDING_ENDPOINT=https://openrouter.ai/api/v1/embeddings
OPENROUTER_HTTP_REFERER=
OPENROUTER_APP_TITLE=Gordi AI

# 컨테이너 내부 경로이므로 일반적으로 변경하지 않습니다.
CATALOG_EMBEDDING_INDEX_PATH=/app/catalog_index/catalog-embeddings.json

# 사용자 이미지 URL을 AI가 직접 가져올 때 허용할 호스트만 등록합니다.
RECOMMENDATION_IMAGE_ALLOWED_HOSTS=["<상품 이미지 도메인>","<사용자 이미지 도메인>"]

# 운영 환경 기본값
ENABLE_RECOMMENDATION_DEMO=false
```

모델명과 임베딩 차원은 생성된 카탈로그 인덱스의 값과 일치해야 합니다. 현재
기본 규격은 `google/gemini-embedding-2`, 768차원입니다.

## 5. 추천 데모 활성화

FastAPI 단독 추천 데모는 환경변수로 제어합니다.

```env
ENABLE_RECOMMENDATION_DEMO=true
```

활성화 경로:

```text
/demo/recommendations
```

데모 화면과 업로드 API에는 별도 사용자 인증이 없으므로 개발·스테이징
환경에서만 활성화하는 것을 권장합니다. 운영에서는 다음 값을 유지합니다.

```env
ENABLE_RECOMMENDATION_DEMO=false
```

## 6. 카탈로그 임베딩 인덱스 배치

추천 검색은 OpenRouter API 키 외에도 사전 생성된 인덱스 파일이 필요합니다.
이 파일은 용량과 생성 비용 때문에 Git에서 제외되어 있으며, `dev` push만으로
EC2에 전달되지 않습니다.

EC2 배치 예시:

```text
/opt/gordi/ai/catalog_index/catalog-embeddings.json
```

환경변수:

```env
CATALOG_EMBEDDING_INDEX_HOST_DIR=/opt/gordi/ai/catalog_index
CATALOG_EMBEDDING_INDEX_PATH=/app/catalog_index/catalog-embeddings.json
```

`docker-compose.prod.yml`은 호스트 디렉터리를 AI 컨테이너의
`/app/catalog_index`에 읽기 전용으로 마운트합니다.

인덱스 파일 배치 시 다음 사항을 확인합니다.

- 파일명이 정확히 `catalog-embeddings.json`인지 확인합니다.
- 파일 소유자와 권한이 Docker 컨테이너에서 읽을 수 있는 상태인지 확인합니다.
- 전달 전에 공유한 SHA-256과 EC2 파일의 SHA-256이 같은지 확인합니다.
- 임베딩 모델과 차원이 환경변수 설정과 일치하는지 확인합니다.

인덱스 파일이나 경로가 잘못되면 FastAPI 프로세스 자체는 시작될 수 있지만,
추천 검색 요청은 `503 Service Unavailable`을 반환합니다.

## 7. 배포 반영 절차

1. Jenkins의 `backend-env-file` Credential을 갱신합니다.
2. EC2 고정 디렉터리에 `catalog-embeddings.json`을 배치합니다.
3. Jenkins의 `dev` 배포 Job을 다시 실행합니다.
4. Jenkins가 `.env`를 workspace에 복사합니다.
5. AI 변경 또는 Compose 변경이 포함되면 다음 명령에 해당하는 단계가
   실행됩니다.

```bash
docker-compose -f docker-compose.prod.yml up -d --build ai
```

환경변수만 변경해도 기존 컨테이너에는 자동 반영되지 않습니다. Credential
갱신 후 반드시 Jenkins Job을 재실행하거나 AI 컨테이너를 재생성해야 합니다.

현재 Compose 파일 자체가 변경되면 Jenkins 변경 감지 로직에 따라 Backend,
Frontend, AI가 모두 재배포됩니다.

## 8. 배포 후 확인

### 8.1 컨테이너 상태

```bash
docker ps --filter name=gordi-ai
docker logs --tail 100 gordi-ai
```

로그에 API 키나 전체 환경변수를 출력하지 않습니다.

### 8.2 환경변수 존재 여부

값 자체를 출력하지 않고 존재 여부만 확인합니다.

```bash
docker exec gordi-ai sh -c '
  test -n "$OPENROUTER_API_KEY" &&
  test -n "$INTERNAL_API_KEY" &&
  echo "required secrets: configured"
'
```

### 8.3 인덱스 마운트

```bash
docker exec gordi-ai sh -c '
  test -r /app/catalog_index/catalog-embeddings.json &&
  echo "catalog index: readable"
'
```

### 8.4 Backend → FastAPI 연결

Backend 컨테이너에서 AI 컨테이너의 health endpoint에 접근할 수 있는지
확인합니다.

```bash
docker exec gordi-backend sh -c '
  wget -qO- http://gordi-ai:8000/ai/v1/health
'
```

Backend 이미지에 `wget`이 없다면 동일 Docker network에 연결된 일회성
컨테이너나 EC2 내부에서 확인합니다.

### 8.5 데모

개발·스테이징에서만 다음 값을 설정하고 컨테이너를 재생성합니다.

```env
ENABLE_RECOMMENDATION_DEMO=true
```

이후 reverse proxy가 해당 경로를 전달하는 환경에서 다음 페이지를 확인합니다.

```text
/demo/recommendations
```

## 9. 장애 확인표

| 증상 | 우선 확인 항목 |
|---|---|
| 추천 API가 503 반환 | 인덱스 파일 경로·마운트·읽기 권한 |
| OpenRouter 401 | `OPENROUTER_API_KEY` 유효성 |
| Backend 호출이 401/403 | 양쪽 `INTERNAL_API_KEY` 일치 여부 |
| Backend에서 AI 연결 실패 | `AI_INTERNAL_BASE_URL=http://gordi-ai:8000`, Docker network |
| 이미지 URL 입력이 거부됨 | `RECOMMENDATION_IMAGE_ALLOWED_HOSTS` 등록 여부 |
| 데모가 404 | `ENABLE_RECOMMENDATION_DEMO=true`와 컨테이너 재생성 여부 |
| 모델 또는 차원 불일치 | 인덱스 metadata와 OpenRouter 모델·차원 설정 |

## 10. 담당자 전달 체크리스트

- [ ] Jenkins `backend-env-file`에 `OPENROUTER_API_KEY` 추가
- [ ] Backend와 AI에 동일한 `INTERNAL_API_KEY` 설정
- [ ] `AI_INTERNAL_BASE_URL=http://gordi-ai:8000` 설정
- [ ] EC2 고정 디렉터리에 카탈로그 인덱스 배치
- [ ] `CATALOG_EMBEDDING_INDEX_HOST_DIR` 설정
- [ ] 실제 이미지 도메인 allowlist 설정
- [ ] 운영 `ENABLE_RECOMMENDATION_DEMO=false` 확인
- [ ] Jenkins Job 재실행
- [ ] 컨테이너, 인덱스, Backend → AI 호출 확인

