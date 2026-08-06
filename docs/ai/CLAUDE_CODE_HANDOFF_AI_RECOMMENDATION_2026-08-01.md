# Claude Code 핸드오프: 의류 카탈로그·멀티모달 추천 파이프라인

작성 시각: 2026-08-01 (Asia/Seoul)  
대상 저장소: `C:\Users\SSAFY\Documents\S15P11D105`  
참조 Codex 작업: `dev 백엔드 진행도 파악` (`019fa7cb-47ba-7941-852a-db902b8ad489`)

## 0. 가장 먼저 읽을 요약

- 현재 브랜치는 `ai/feat/garment-recommendation`이다.
- 현재 HEAD는 `440429ec0c85e14b90ace55906ed82e3cc5d25a0`이며 로컬이 알고 있는
  `origin/ai/feat/garment-recommendation`과 일치한다.
- 검증된 추천 파이프라인 커밋은 이미 원격에 push됐다.
- 현재 로컬에는 Compose·환경변수 예시·운영/로컬 실행 문서 변경이 미커밋으로
  남아 있다. 사용자 작업이므로 임의로 버리거나 덮어쓰면 안 된다.
- 로컬 임베딩 인덱스는 `COMPLETE`, 198상품, 768차원이며 Git에서 제외된다.
- 현재 추천 품질은 완성형이 아니다. 멀티모달 유사도 검색 65%와 텍스트
  키워드 규칙 기반 궁합 35%를 합친 baseline으로, 실제 코디 궁합보다는
  "비슷한 상품 검색"에 가깝다.
- 백엔드의 실제 서비스 경로는 아직 `/internal/v1/recommendations/rank`를
  호출한다. 새 벡터 검색 `/internal/v1/recommendations/search`는 FastAPI와
  데모에 구현됐지만 Spring 추천 생성 흐름에는 아직 연결되지 않았다.
- 다음 핵심 작업은 이미지 속성 추출, pairwise 코디 궁합/VLM 재정렬,
  평가 데이터셋과 지표 구축이다.

## 1. 현재 Git 상태

### 브랜치와 원격 추적

```text
branch: ai/feat/garment-recommendation
HEAD: 440429ec0c85e14b90ace55906ed82e3cc5d25a0
tracking: origin/ai/feat/garment-recommendation
local vs tracking branch: 동일
local origin/dev vs HEAD: 0 behind / 21 ahead
local origin/dev: aea8825 fix: product table
```

`origin/dev` 비교는 2026-08-01 현재 로컬에 저장된 remote ref 기준이다. 병합이나
PR 생성 전에는 반드시 `git fetch` 후 다시 비교한다.

현재 브랜치의 21개 ahead 커밋에는 기존 `ai/feat/image-gather` 작업과 dev merge
5개가 포함된다. 이번 핸드오프의 직접적인 구현 범위는 `4ec63f2`부터
`440429e`까지 16개 커밋이다.

### 미커밋 변경

```text
 M .env.example
 M ai/README.md
 M docker-compose.local.yml
 M docker-compose.prod.yml
?? docs/ai/AI_RECOMMENDATION_CICD_ENV_GUIDE.md
?? docs/ai/DOCKER_LOCAL_RECOMMENDATION_DEMO_GUIDE.md
?? docs/ai/CLAUDE_CODE_HANDOFF_AI_RECOMMENDATION_2026-08-01.md
```

기존 tracked 파일의 미커밋 diff는 4파일, 27줄 추가다.

| 파일 | 미커밋 내용 | 주의 |
|---|---|---|
| `.env.example` | 인덱스 host/container 경로 2개 추가 | 비밀값 없음 |
| `ai/README.md` | 인덱스가 Git에 없고 별도 배치해야 한다는 운영 설명, Compose 데모 플래그 설명 | 문서 변경 |
| `docker-compose.local.yml` | 내부 키, 인덱스 경로, 이미지 allowlist, 데모 플래그 전달 및 read-only 인덱스 mount | 로컬 기본 allowlist는 `localhost`, `gordi-nginx` |
| `docker-compose.prod.yml` | 같은 설정과 read-only 인덱스 mount | 운영 기본 이미지 allowlist는 빈 배열, 데모 기본 false |
| `docs/ai/AI_RECOMMENDATION_CICD_ENV_GUIDE.md` | Jenkins/EC2의 환경변수 및 인덱스 배치 가이드 | 미추적, 약 7.5KB |
| `docs/ai/DOCKER_LOCAL_RECOMMENDATION_DEMO_GUIDE.md` | Docker 로컬 DB·임베딩·데모 전체 실행 가이드 | 미추적, 약 21KB |
| 이 문서 | Claude Code 인수인계 | 이번 요청으로 새로 생성 |

이 변경들은 마지막 push에 의도적으로 포함하지 않았다. 커밋 여부와 커밋 경계는
사용자에게 확인하되, 최소한 Compose/환경변수 변경과 문서 변경은 분리 커밋하는
편이 좋다.

## 2. 작업의 출발점과 방향 전환

초기 점검 시점의 `dev` 백엔드는 공통 응답/인증/엔티티 중심으로 전체 제품 기준
약 25~30% 수준이었다. 이후 하루 동안 백엔드에 상품, 추천, 방, WebSocket,
아바타 등의 기능이 대량 병합됐다. 그 결과 AI에 직접 생긴 요구사항은 다음이었다.

1. Spring이 `POST /internal/v1/recommendations/rank`를 필수 호출하므로 FastAPI가
   동일 계약을 제공해야 한다.
2. 추천 전에 상품 원본 카탈로그가 필요하므로 기존 수집 데이터 정비, S3 업로드,
   MySQL seed가 선행돼야 한다.
3. 단순 후보 랭킹을 넘어 AI가 사용자 이미지/텍스트로 직접 카탈로그를 검색하는
   멀티모달 파이프라인이 필요하다.

이 흐름에 맞춰 "백엔드 계약 baseline → 데이터 정비/적재 도구 → 멀티모달 검색 →
규칙 기반 재정렬 → 내부 API/데모" 순서로 구현했다.

## 3. 완료한 작업

### 3.1 Spring 연동용 baseline rank API

구현된 API:

```http
POST /internal/v1/recommendations/rank
X-Internal-Api-Key: ${INTERNAL_API_KEY}
```

- Spring DTO와 동일한 camelCase 요청/응답을 받는다.
- 내부 API 키를 검증한다. 키가 비어 있으면 로컬 개발을 위해 검증을 생략한다.
- 후보의 성별, 카테고리, 세부 카테고리, 가격 조건을 AI에서도 재검증한다.
- 실제 ML 모델이 없어도 서비스 계약이 막히지 않도록 결정적인 baseline ranker를
  제공한다.
- baseline은 예산 적합도와 mood 텍스트 포함 여부를 사용한다.
- 후보 최대 200개, 결과 최대 100개, 중복 ID/잘못된 예산 등을 검증한다.

주의: Spring의 `RecommendationRankClient`는 현재도 이 `/rank` 경로만 호출한다.

### 3.2 백엔드 상품/추천 성별 및 카테고리 계약 정렬

- `Product.gender`를 `MALE/FEMALE/UNISEX` 필수 값으로 추가했다.
- `Recommendation.gender`에 생성 당시 아바타 성별을 snapshot으로 저장한다.
- 추천 생성 시 공개 요청 body에서 성별을 받지 않고 인증 사용자의 선택 아바타에서
  가져온다. 아바타가 없으면 400으로 거부한다.
- 상품 후보/가격 쿼리는 아바타와 같은 성별 또는 `UNISEX`만 포함한다.
- AI `RankCondition`, `RankCandidate`에도 gender를 추가했다.
- 세부 카테고리에 다음 코드를 추가했다.

```text
SLEEVELESS, SPORTS_TOP, OTHER_TOP, DRESS,
COTTON_PANTS, JOGGER_PANTS, SPORTS_BOTTOM, OTHER_BOTTOM
```

- 추천 조건 응답에도 실제 적용된 gender를 포함한다.

### 3.3 의류 데이터셋 v2 정비

기존 raw 465건을 신규 네트워크 수집 없이 오프라인 재처리했다.

- schema를 `garment-dataset-v2`로 분리했다.
- 상품당 primary 이미지 1장만 유지했다.
- alternate/detail/배너/장문 상세 이미지는 v2 결과에서 제외했다.
- 검수 전 이미지 판별값을 `UNKNOWN/null`로 두어 기존 하드코딩된
  `FRONT/model_present=true` 문제를 제거했다.
- `style_group_id=0`을 null로 정규화했다.
- raw bundle SHA-256의 의미를 결정적으로 재현 가능하게 정리했다.
- 드레스는 `TOP/DRESS`, 세트는 첫 구성품 기준 임시 분류를 유지하면서 원본 분류와
  사유, 세트 여부를 보존했다.
- raw/normalized/images/reports/probe/pilot와 v2 산출물은 Git에서 제외했다.

검증 결과:

```text
normalized: 465
primary images: 465
alternate/orphan/duplicate primary: 0
수동 검수 READY: 198
거부: 0
```

### 3.4 DB seed manifest와 전송 bundle

- `gordi-product-seed-v1` manifest exporter를 구현했다.
- source는 `MUSINSA`, 식별자는 `external_id`를 사용한다.
- `(source, external_id)`가 DB의 멱등 키다.
- size 값은 DB export 시 `ROUND_HALF_UP`, 소수 둘째 자리로 변환한다.
- 필수 치수, enum, unique ID, 이미지 hash 검증 중 하나라도 실패하면 전체 export를
  실패시킨다.
- 수동 검수 완료 항목만 READY로 export한다.

산출 결과:

```text
상품: 198
성별: 남성 98 / 여성 100
카테고리: TOP 98 / BOTTOM 100
사이즈 행: 732 (상의 273 / 하의 459)
manifest SHA-256: c51deaaf4a9667416830621f3b3e2388d53a4d00f18b9c31d3b96ec5c5b89855
bundle SHA-256: 00f4bd1725b5a9ce1717b95dfefb5e59172c527e6fa12093db5dfa2b6bdaedfc
```

manifest와 tar bundle은 Git에서 제외된다. 로컬 경로는 다음이다.

```text
ai/garment_dataset-v2/reports/gordi-product-seed-v1.json
ai/garment_dataset-v2/reports/gordi-garment-seed-198.tar
ai/garment_dataset-v2/reports/gordi-garment-seed-198.tar.sha256
```

### 3.5 멱등 S3 uploader

- boto3 기반 `upload-s3` 명령과 전용 도구 Dockerfile을 추가했다.
- 객체 키를 다음 형식으로 고정했다.

```text
garments/musinsa/{external_id}/primary-{sha256-prefix}.{ext}
```

- `HeadObject`로 기존 객체 크기/hash를 확인한다.
- 동일하면 skip, 다르면 overwrite하지 않고 충돌로 실패한다.
- Content-Type, SHA-256 metadata, SSE-S3를 설정한다.
- public ACL을 사용하지 않는다.
- DB에는 presigned URL이 아니라 내부망 고정 URL을 기록한다.
- Stubber 기반 성공/재실행/충돌 테스트를 추가했다.

중요: 실제 운영 S3 업로드는 아직 수행하지 않았다. 구현과 로컬 테스트 도구만
완료됐다.

### 3.6 트랜잭션 MySQL seeder와 로컬 적재

- PyMySQL 기반 `seed-db --dry-run/--apply`를 구현했다.
- 시작 전 product 컬럼, `(source, external_id)` unique, 사이즈 테이블 구조를
  검증한다.
- 전체 198건을 하나의 트랜잭션으로 처리한다.
- 상품은 upsert하고 해당 상품의 사이즈만 삭제 후 재삽입한다.
- 적용 전 대상 행을 JSON으로 백업한다.
- 중간 실패 시 전체 rollback한다.

실제 로컬 Docker MySQL 통합 테스트에서 발견해 수정한 문제:

1. 도구 이미지 requirements에 `httpx`가 누락돼 CLI가 시작되지 않음.
2. 실제 `products.created_at`이 기본값 없는 non-null이라 INSERT 실패.
3. 최초 실패는 전체 rollback돼 DB가 0건으로 유지됨을 확인.
4. INSERT에 `CURRENT_TIMESTAMP`를 명시한 뒤 정상 적재.

로컬 DB 검증 결과:

```text
products: 198
sizes: 732
duplicates(source, external_id): 0
availability=AVAILABLE: 198
recommendations: 0
동일 manifest 재적재 후 증가분: 0
```

로컬 검증용 DB 이미지 URL은 `http://gordi-nginx/...` placeholder다. 실제 운영 S3
URL smoke test는 별도다.

### 3.7 Gemini 멀티모달 카탈로그 임베딩

현재 provider와 모델:

```text
API gateway: OpenRouter
model: google/gemini-embedding-2
dimensions: 768
provider order: google-vertex only
allow_fallbacks: false
```

카탈로그 상품마다 다음을 하나의 멀티모달 입력으로 임베딩한다.

- 상품명
- 브랜드
- 성별
- 카테고리/세부 카테고리
- 설명
- primary 이미지 한 장

가격과 availability는 embedding이 아니라 metadata filter에 사용한다.

- checkpoint와 입력 hash를 사용해 중단 후 재실행 시 성공 항목을 재사용한다.
- snapshot은 `COMPLETE` 상태와 SHA-256을 가진다.
- 불완전 snapshot은 런타임 검색에서 거부한다.
- 생성물 `ai/catalog_index/catalog-embeddings.json`은 Git에서 제외된다.

현재 로컬 snapshot:

```text
status: COMPLETE
model: google/gemini-embedding-2
dimensions: 768
product_count: 198
snapshot_sha256: 7fc0e03bc8f5d2dcc2a5e25c9e17cb17cd709e4e3c9ccb66055cec05d0c08a94
```

### 3.8 벡터 검색, 규칙 기반 재정렬, 내부 search API

구현된 새 API:

```http
POST /internal/v1/recommendations/search
X-Internal-Api-Key: ${INTERNAL_API_KEY}
```

- 사용자 텍스트와 이미지 중 하나 이상을 받는다.
- 텍스트는 `task: search result | query: ...` 형태로 넣는다.
- 텍스트와 이미지를 하나의 768차원 결합 임베딩으로 만든다.
- 별도 vector DB 없이 198개 snapshot을 메모리에 올리고 exact cosine search를 한다.
- 이미지 URL fetch는 scheme/host allowlist와 redirect 단계별 재검증으로 SSRF를
  방어한다.
- 상품 image/purchase URL도 HTTP/HTTPS 유효성을 검사한다.
- 인덱스 또는 API 키가 없으면 dependency 단계의 오류를 503으로 변환한다.

### 3.9 FastAPI 단독 추천 데모

```text
GET  /demo/recommendations
POST /api/v1/demo/recommendations
GET  /demo/catalog-images/{source}/{external_id}
```

- `ENABLE_RECOMMENDATION_DEMO=true`일 때만 노출된다.
- false이면 페이지와 upload API 모두 404다.
- JPEG/PNG 최대 10MB, 텍스트 최대 2,000자를 받는다.
- 성별, 카테고리, 세부 카테고리, 최소/최대 가격, 후보/결과 수를 입력한다.
- DB 이미지 URL이 브라우저에서 열리지 않을 때 로컬 검수 dataset의 primary만
  제공하는 제한 경로가 있다.
- 데스크톱과 모바일 반응형, 입력/실행/오류 복구를 브라우저로 확인했다.

## 4. 현재 추천 파이프라인의 정확한 동작

```text
사용자 텍스트 또는 이미지
    ↓
입력 검증
    ↓
OpenRouter Gemini Embedding 2 결합 임베딩 (768차원)
    ↓
하드 필터
  - availability == AVAILABLE
  - 요청 성별과 동일 또는 UNISEX
  - category / subcategory
  - budget min / max
    ↓
exact cosine similarity 검색, 기본 상위 50개
    ↓
사용자 텍스트와 상품 metadata에서 색상/계절/스타일 키워드 추출
    ↓
규칙 기반 compatibility score
    ↓
final_score = retrieval_score * 0.65 + compatibility_score * 0.35
    ↓
상위 10개, 동점 시 product_id 오름차순
    ↓
규칙 기반 추천 이유 생성
```

점수 세부:

```text
retrieval_score = (cosine_similarity + 1) / 2

compatibility 요소별 예시:
- 정확히 일치: 1.0
- 중립색 조합: 0.8
- 정의된 배색 조합: 0.75
- 상품 태그 미확인: 0.5
- 불일치: 0.2
- 사용자 조건 자체가 없음: 해당 요소 계산 제외
```

한계:

- 이미지가 embedding에는 반영되지만 색상/계절/스타일 규칙에는 직접 반영되지
  않는다.
- 학습된 pairwise 코디 궁합 모델이 없다.
- VLM reranker가 없다.
- 추천 이유는 LLM이 아니라 규칙 기반이다.
- 결과적으로 현재는 "코디 궁합"보다 "멀티모달로 비슷한 상품 찾기" 성격이 강하다.

## 5. OpenRouter/Vertex 장애와 최종 결정

발생한 오류:

```text
OpenRouter embedding request failed with status 400
API key not valid
domain: googleapis.com
reason: API_KEY_INVALID
```

진단 결과 동일 OpenRouter 키로 Vertex 고정 텍스트+합성 이미지, 768차원 요청은
정상 성공했다. 문제는 Google AI Studio fallback 경로였다.

두 단계의 수정이 있었다.

1. 카탈로그 CLI에서 provider를 Vertex 우선으로 지정.
2. FastAPI 런타임 조립 코드도 provider order와 allow_fallbacks를 실제 전달하도록
   수정.

최종 안전 기본값:

```env
OPENROUTER_PROVIDER_ORDER=google-vertex
OPENROUTER_ALLOW_FALLBACKS=false
```

기본 코드도 Vertex 단독/fallback false다. 데모 컨테이너가 이전 이미지를 쓰면
같은 오류가 다시 보일 수 있으므로 코드 변경 후에는 Compose AI 이미지를 새로
빌드하고 컨테이너를 재생성해야 한다.

## 6. 확정된 설계 결정

1. 상품 멱등 키는 `(source, external_id)`다.
2. 1차 데이터는 기존 raw에서 선정된 198건만 사용하고 신규 네트워크 수집은 하지
   않는다.
3. 상품당 primary 이미지만 추천/DB/S3 대상으로 사용한다.
4. 이미지 원본과 dataset/report/index는 Git에 넣지 않는다.
5. S3는 private이고 public ACL을 쓰지 않는다.
6. DB에는 만료되는 presigned URL이 아니라 내부망 고정 URL을 저장한다.
7. 성별은 공개 추천 요청 입력이 아니라 인증 사용자의 선택 avatar에서 파생한다.
8. 추천 생성 당시 성별을 Recommendation에 snapshot으로 남긴다.
9. 판매 상태, 성별, 카테고리, 가격은 vector 검색 전 hard filter다.
10. 색상/스타일은 다양성을 보존하기 위해 현재 soft score다.
11. 현재 MVP는 외부 vector DB 없이 198개 exact cosine 검색을 사용한다.
12. OpenRouter provider는 `google-vertex`만 허용하고 fallback을 끈다.
13. 데모는 운영 기본 false이며 명시적으로 켤 때만 노출한다.
14. 추천 이유는 검증된 metadata/점수 근거에 기반해야 하며 자유 생성 환각을 피한다.

## 7. 커밋 이력

이번 구현의 16개 커밋은 모두 현재 원격 feature branch에 push됐다.

| 순서 | 커밋 | 내용 |
|---:|---|---|
| 1 | `4ec63f2` | backend-compatible `/rank` endpoint |
| 2 | `4446cff` | 상품/추천 gender 및 subcategory 계약 정렬 |
| 3 | `070ac6e` | primary-only garment dataset v2 |
| 4 | `16c28a5` | validated seed manifest exporter |
| 5 | `cc5d7d0` | idempotent S3 uploader |
| 6 | `ce190f7` | transactional MySQL seeder |
| 7 | `a874484` | 도구 이미지 httpx와 DB created_at 런타임 정합성 수정 |
| 8 | `a063d5f` | garment seed 진행 보고서 |
| 9 | `04753b9` | Gemini multimodal catalog embeddings |
| 10 | `9e1d5f6` | filtered catalog vector retrieval |
| 11 | `305521e` | compatibility reranking pipeline |
| 12 | `7a79ad1` | multimodal `/search` API |
| 13 | `e4c5391` | standalone recommendation demo |
| 14 | `3cacdb5` | embedding gateway를 OpenRouter로 전환 |
| 15 | `b0cba87` | Gemini embedding provider를 Vertex 우선으로 수정 |
| 16 | `440429e` | FastAPI 런타임도 Vertex 단독으로 고정 |

## 8. 수정 파일 목록

`4ec63f2^..440429e` 범위는 총 72개 파일이다.

### FastAPI API/설정/스키마

```text
.env.example
ai/README.md
ai/app/api/dependencies.py
ai/app/api/internal_router.py
ai/app/api/router.py
ai/app/api/routes/internal_recommendations.py
ai/app/api/routes/recommendation_demo.py
ai/app/core/config.py
ai/app/core/security.py
ai/app/main.py
ai/app/schemas/__init__.py
ai/app/schemas/recommendation.py
ai/app/services/recommendation_pipeline.py
ai/app/services/recommendation_ranker.py
ai/app/static/recommendation_demo.html
ai/requirements.txt
docker-compose.local.yml
docker-compose.prod.yml
```

### 추천/임베딩 핵심

```text
ai/app/recommendation/__init__.py
ai/app/recommendation/catalog.py
ai/app/recommendation/catalog_embeddings.py
ai/app/recommendation/embedding_cli.py
ai/app/recommendation/image_fetcher.py
ai/app/recommendation/pipeline.py
ai/app/recommendation/vector_index.py
```

### 의류 collector/seed/S3/MySQL 도구

```text
.gitignore
ai/.dockerignore
ai/Dockerfile.garment-tools
ai/requirements-garment-tools.txt
ai/garment_collector/__init__.py
ai/garment_collector/__main__.py
ai/garment_collector/adapters/__init__.py
ai/garment_collector/adapters/base.py
ai/garment_collector/adapters/musinsa/__init__.py
ai/garment_collector/adapters/musinsa/adapter.py
ai/garment_collector/adapters/musinsa/parser.py
ai/garment_collector/cli.py
ai/garment_collector/config.py
ai/garment_collector/http_client.py
ai/garment_collector/images.py
ai/garment_collector/models.py
ai/garment_collector/mysql_seeder.py
ai/garment_collector/pipeline.py
ai/garment_collector/rate_limit.py
ai/garment_collector/reprocess.py
ai/garment_collector/s3_uploader.py
ai/garment_collector/seed_manifest.py
ai/garment_collector/storage.py
ai/garment_collector/validate.py
```

### 백엔드 계약

```text
backend/src/main/java/com/ssafy/backend/config/enums/CategoryCode.java
backend/src/main/java/com/ssafy/backend/config/enums/GenderCode.java
backend/src/main/java/com/ssafy/backend/config/enums/SubcategoryCode.java
backend/src/main/java/com/ssafy/backend/domain/Product.java
backend/src/main/java/com/ssafy/backend/domain/Recommendation.java
backend/src/main/java/com/ssafy/backend/dto/recommendation/RankCandidate.java
backend/src/main/java/com/ssafy/backend/dto/recommendation/RankCondition.java
backend/src/main/java/com/ssafy/backend/dto/recommendation/RecommendationConditionResponse.java
backend/src/main/java/com/ssafy/backend/repository/ProductRepository.java
backend/src/main/java/com/ssafy/backend/service/RecommendationService.java
```

### 테스트

```text
ai/tests/test_catalog_embeddings.py
ai/tests/test_garment_dataset_v2.py
ai/tests/test_garment_mysql_seeder.py
ai/tests/test_garment_s3_uploader.py
ai/tests/test_recommendation_demo.py
ai/tests/test_recommendation_pipeline.py
ai/tests/test_recommendation_rank.py
ai/tests/test_recommendation_search_api.py
ai/tests/test_vector_index.py
backend/src/test/java/com/ssafy/backend/dto/recommendation/RecommendationOptionsResponseTest.java
backend/src/test/java/com/ssafy/backend/service/RecommendationServiceTest.java
```

### 운영 문서

```text
docs/ai/2026-07-31_garment_catalog_seed_progress_report.md
docs/ai/garment-seed-ec2-runbook.md
```

## 9. 검증 기록과 현재 재검증 상태

참조 작업에서 확인된 기록:

- dataset v2/seed/S3/MySQL 도구 테스트: 18 passed 시점 존재.
- FastAPI 검색/데모 통합 후: 53 passed.
- OpenRouter 전환과 Vertex 런타임 fix 후 전체 AI 테스트: 61 passed.
- FastAPI OpenAPI에 내부 rank/search와 데모 API가 포함됨.
- 데모 HTML은 OpenAPI schema에서 제외됨.
- 데스크톱과 약 375~390px 모바일에서 가로 넘침 없이 렌더링됨.
- 입력, 실행 버튼, 오류 복구, 브라우저 console error 0건 확인.
- 별도 Docker 이미지 build와 일회성 컨테이너에서 데모 페이지 200 확인.
- 사용자가 최종 데모 컨테이너에서 파이프라인 작동을 직접 확인함.
- 카탈로그 인덱스는 현재도 `COMPLETE/198/768`로 파일 확인됨.

2026-08-01 현재 이 핸드오프를 만들며 재검증한 내용:

- Java 21.0.11 설치 확인.
- 현재 Codex shell에는 `docker` executable이 없어 컨테이너 상태를 재확인하지
  못함.
- bundled Python에는 pytest가 없고 별도 pytest 실행 환경도 발견되지 않아 AI
  테스트를 재실행하지 못함.
- 백엔드 `gradlew.bat test`는 Gradle 9.5.1 distribution 다운로드가 sandbox
  network 권한으로 차단돼 시작 전 종료됨. 코드 테스트 실패가 아니다.

따라서 새 변경을 시작하기 전에 사용자의 일반 개발 shell/Docker 환경에서 아래를
재실행하는 것이 좋다.

```powershell
cd ai
python -m pytest

cd ..\backend
.\gradlew.bat test

cd ..
git diff --check
```

## 10. 아직 남은 일

### P0: 추천 품질 개선

1. 이미지 속성 추출
   - query 이미지에서 색상, 의류 카테고리, 계절감, 스타일/무드, 패턴을 구조화한다.
   - 현재 텍스트 keyword extractor와 동일한 intent schema로 합친다.

2. 실제 코디 궁합 reranker
   - 기준 의상/사용자 이미지와 후보 상품의 pairwise compatibility를 평가한다.
   - 초기에는 VLM을 상위 20개에만 적용하거나, 공개 fashion compatibility 모델을
     baseline으로 비교한다.
   - 현재 `RuleBasedCompatibilityModel` 인터페이스를 교체 지점으로 사용한다.

3. 평가 데이터셋과 지표
   - 먼저 소규모 사람 평가 pair/랭킹셋을 만든다.
   - retrieval recall@K, nDCG@K, pairwise accuracy, 다양성, latency, OpenRouter 비용을
     기록한다.
   - 데이터 없이 0.65/0.35 weight를 감으로 계속 조정하지 않는다.

4. 후보 수 재검토
   - 현재 기본 50개는 198상품 MVP에서는 동작하지만 확장 시 100~200개 retrieval,
     20~30개 compatibility rerank, 최종 10개가 안전하다.

5. 근거 기반 추천 이유
   - 모델 기반으로 바꾸더라도 실제 색상/계절/카테고리/점수 근거만 전달해 생성한다.
   - 현재 `GroundedReasonGenerator`가 교체 지점이다.

### P0: 실제 서비스 연결

1. Spring은 여전히 `/rank`를 호출한다. 다음 중 하나를 결정해야 한다.
   - Spring이 사용자 이미지 URL/텍스트/필터만 AI `/search`에 보내도록 계약 변경.
   - 또는 Spring이 검색 후보를 만들고 `/rank`가 새 pipeline을 사용하도록 통합.
2. 현재 설계 의도에는 AI가 vector index에서 후보를 직접 찾는 `/search` 방식이 더
   가깝다.
3. 공개 앱의 사용자 이미지 전달 방식, 내부 URL allowlist, avatar/try-on 결과 중
   어떤 이미지를 query로 쓸지 계약을 확정해야 한다.
4. 내부 API key는 Spring과 FastAPI 양쪽에 같은 값으로 배포해야 한다.

### P0: 운영 데이터/배포

1. 실제 EC2 S3 업로드는 아직 안 했다.
2. 실제 운영 MySQL seed도 아직 안 했다. 로컬 MySQL만 198/732 검증됐다.
3. 운영 전 `docs/ai/garment-seed-ec2-runbook.md`에 따라 S3 dry-run/apply/재실행과 DB
   dry-run/backup/apply/재실행을 수행한다.
4. `catalog-embeddings.json`은 Git push로 배포되지 않는다. Jenkins workspace
   밖의 지속 경로에 별도 복사하고 Compose에 read-only mount한다.
5. 인덱스 artifact의 snapshot SHA와 DB 상품 198건의 일치 여부를 배포 전 확인한다.
6. 미커밋 Compose/문서 변경을 검토하고 커밋해야 일반 Compose 배포에서 index
   mount와 demo/internal 설정이 안정적으로 전달된다.
7. 운영에서는 `ENABLE_RECOMMENDATION_DEMO=false`와 좁은
   `RECOMMENDATION_IMAGE_ALLOWED_HOSTS`를 유지한다.

### P1: 안정성/확장성

- 상품 수 증가 시 exact in-memory cosine을 FAISS/pgvector/vector DB로 교체한다.
- embedding model/version/dimensions 변경 시 full rebuild와 blue/green index 교체
  절차를 만든다.
- OpenRouter 429/5xx retry, latency/비용/실패율 metric을 추가한다.
- provider fallback을 다시 열 경우 AI Studio 경로의 인증 문제를 먼저 별도 해결한다.
- catalog update → incremental embedding → snapshot publish 자동화를 만든다.
- 데모와 내부 API의 request size, timeout, rate limit을 운영 수준으로 명시한다.

## 11. Claude Code가 바로 이어서 할 순서

1. 작업 트리를 보존한 채 현재 상태를 확인한다.

```powershell
git status --short --branch
git diff -- .env.example ai/README.md docker-compose.local.yml docker-compose.prod.yml
```

2. 이 문서와 두 미추적 실행 가이드를 읽는다.

```text
docs/ai/CLAUDE_CODE_HANDOFF_AI_RECOMMENDATION_2026-08-01.md
docs/ai/AI_RECOMMENDATION_CICD_ENV_GUIDE.md
docs/ai/DOCKER_LOCAL_RECOMMENDATION_DEMO_GUIDE.md
docs/ai/2026-07-31_garment_catalog_seed_progress_report.md
docs/ai/garment-seed-ec2-runbook.md
```

3. 원격 최신 상태를 가져오고 충돌 가능성을 확인한다. 사용자 승인 없이 현재
   미커밋 변경을 reset/checkout하지 않는다.

4. AI 61개 테스트와 backend 테스트를 재실행한다.

5. 사용자와 다음 작업 목표를 확인한다.
   - 권장 기본값: "추천 품질 개선 1단계 — 이미지 속성 추출 + 평가셋".
   - 배포가 급하면 먼저 미커밋 Compose/운영 문서를 검토·커밋하고 EC2 artifact
     배치 절차를 완료한다.

6. 품질 개선을 시작한다면 구현 전에 최소 평가셋과 baseline 결과를 고정한다.
   기존 0.65/0.35 점수보다 실제로 나아졌음을 지표로 증명한다.

## 12. 위험 및 절대 하지 말아야 할 것

- 현재 미커밋 파일을 `git reset --hard`, `git checkout --`, `git clean`으로 버리지
  않는다.
- `ai/catalog_index`, `garment_dataset*`, seed manifest, tar bundle을 Git에
  커밋하지 않는다.
- OpenRouter/AWS/MySQL credential을 `.env.example`, 문서, manifest, commit에 넣지
  않는다.
- 운영에서 demo를 켜거나 이미지 allowlist를 광범위하게 열지 않는다.
- S3 충돌 객체를 자동 overwrite하지 않는다.
- 운영 DB seed 전에 backup과 dry-run을 생략하지 않는다.
- 이미지 유사도만으로 "코디 추천 품질 완료"라고 판단하지 않는다.

