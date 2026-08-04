# 2026-08-02 ~ 08-04 AI 구현·EC2 배포 회고

브랜치: `ai/feat/garment-recommendation` (08-03 dev 병합 완료, 이후 `53428fe`만 미병합)
범위: 데이터셋 확장 검수 → VLM 자동 검수 → /rank 벡터 전환 → try-on FastAPI →
env 분리 → S3 업로드 → EC2 DB 시드 → 스냅샷 재발행 → EC2 인덱스 배치

## 구현 사항 요약

| 커밋 | 내용 |
|---|---|
| `003988f` | 야간 수집분 병합: 데이터셋 2,943건 (정책 v1.1.0 — 실행 상한 제거, 상품 간 3.0s 하한 유지) |
| `5c441e5` | VLM 자동 검수 파이프라인 (`review-images`): view/reference_type/model_present 판정 → REVIEW_REQUIRED 1,812건 READY 승격, reviewer=`vlm:<model>` 기록 |
| `b0b0e25` | 이미지 검수 reasoning effort 설정화 (Gemma 계열은 reasoning 필드 거부 → 빈 값 허용) |
| `42de9e9` | seed-db/export-seed 기대값 CLI 오버라이드 (198건 하드코딩 제거, 확장 manifest 지원) |
| `e463427` | `/rank`를 벡터 파이프라인으로 전환: MoodCode→한국어 질의 임베딩, 인덱스 검색 + 룰 궁합 결합, 인덱스·키 불가 시 baseline 자동 fallback |
| `a281251` | try-on FastAPI 구현: 202 접수 + BackgroundTasks, Nano Banana 2(gemini-3-pro-image) 생성, PERSON BASE/GARMENT ONLY 프롬프트 역할 분리, SizeProfile 치수 반영, Spring 이벤트 콜백(PROCESSING→SUCCEEDED/FAILED) |
| `7a3ecfe` | 파트별 env 분리: AI 변수를 `ai/.env`로 이동 (pydantic 2단 env_file, compose `required:false`), `ai/.env.example` 템플릿 |
| `318591f` | try-on 계약을 Spring 클라이언트와 정합화 (X-Internal-Token, 202 응답 본문, 상태 GET) |
| `53428fe` | 임베딩 재사용 키를 `input_sha256` 단독으로 수정 (아래 트러블슈팅 4) |

커밋 외 산출물 (Git 제외 아티팩트):

- S3 업로드: `gordi-app-bucket`(ap-northeast-2)에 primary 이미지 **1,991/1,991** 업로드,
  멱등성 재검사 전량 skip 확인. 객체 키 `garments/musinsa/{external_id}/primary-{sha16}.{ext}`,
  SSE-S3, private, overwrite 금지.
- S3-enriched manifest: `gordi-product-seed-expansion-v1-uploaded.json` — 백/프론트가 쓸
  이미지 경로는 이 manifest의 S3 URL로 DB에 들어간다. JSON 자체는 크롤링 데이터
  재배포 문제로 Git 제외가 맞고, 소비 인터페이스는 DB 테이블이다.
- EC2 DB 시드: `products` 1,991건(TOP 1,087/BOTTOM 904) + 사이즈 6,573행,
  dry-run→백업→apply, 한글/S3 URL 검증 완료.
- EC2 스냅샷: `catalog-embeddings.json`을 EC2 실제 id(1129~3119)로 재발행
  (전량 체크포인트 재사용, **임베딩 API 호출 0회**), `/opt/gordi/ai/catalog_index/`와
  현 컨테이너 마운트 경로 양쪽 배치, SHA-256 `decfe339…` 로컬↔EC2 일치,
  컨테이너 읽기 확인, health 정상.

## 설계 결정

1. **스냅샷은 DB별로 재발행한다.** 스냅샷의 `product_id`는 대상 DB의
   auto-increment id에 바인딩되므로 로컬 스냅샷을 EC2에 복사하면 안 된다.
   실제로 EC2 id는 1129부터 시작해 로컬과 전혀 달랐다. 재발행 비용은
   재사용 키 수정 후 0원이다.
2. **비밀값 주입은 CI/CD 담당자 경계.** 실행 중 workspace `.env`는 다음
   Jenkins 빌드에서 credential로 덮어써지므로, 내가 EC2에 임시 주입해도
   유지되지 않는다. OpenRouter 키를 포함한 영구 반영은 Jenkins credential
   업데이트로만 한다 (팀 합의 확인).
3. **인덱스는 고정 디렉터리(`/opt/gordi/ai/catalog_index`)에 둔다.**
   CICD 가이드대로 workspace 밖에 배치하고 `CATALOG_EMBEDDING_INDEX_HOST_DIR`로
   마운트한다. 전환기 동안 기존 마운트 경로에도 복사해 어느 쪽이 mount돼도
   동작하게 했다.

## 트러블슈팅 기록

### 1. seed-db가 SSH 터널 경유 시 2분 타임아웃

터널 왕복 지연 × 약 14,500 statement(INSERT/SELECT/DELETE)라 기본 2분을
초과. 트랜잭션이라 중단 시 깨끗하게 롤백됨을 확인하고 10분 타임아웃으로
재실행해 약 5분에 완료. **원격 DB 시드는 총 statement 수 × RTT로 소요
시간을 먼저 추정할 것.**

### 2. Jenkins DooD의 바인드 경로 착시

compose는 Jenkins 컨테이너 안에서 실행되지만 바인드 마운트는 **호스트**
경로로 해석된다. 호스트의 `/var/jenkins_home/workspace/...`는 Docker가
자동 생성한 빈 디렉터리였고, 실제 checkout은 Jenkins 볼륨
(`/var/lib/docker/volumes/jenkins_home/_data/...`)에 있다. 인덱스가
컨테이너에서 비어 보였던 원인. 파일을 호스트 자동 생성 경로에 넣으면
재기동 없이 즉시 컨테이너에 보인다.

### 3. 실행 중 체크포인트 파일을 열면 빌드가 죽는다 (WinError 5)

임베딩 빌더는 아이템마다 `os.replace`로 체크포인트를 원자 교체하는데,
Windows는 열린 파일을 교체할 수 없다. 진행 확인용 `json.load`가 교체와
경합해 `WinError 5`로 빌드 전체가 사망. **진행 확인은 `ls`(파일 크기)로만.**

### 4. 재사용 키에 product_id가 들어가 있던 잠복 버그

체크포인트 재사용 키가 `(product_id, input_sha256)`이어서 DB가 바뀌면
(id 재바인딩) 전량 캐시 미스 → 1,991건 재과금될 뻔했다. 해시가
model/dimensions/document/이미지 내용을 모두 커버하므로 임베딩은 입력만의
순수 함수 — 키를 `input_sha256` 단독으로 수정(`53428fe`). **캐시 키에는
결과를 결정하는 입력만 넣는다. 환경 종속 식별자는 넣지 않는다.**

### 5. 체크포인트 쓰기가 O(n²)라 전량 재사용이어도 ~30분

아이템마다 전체 스냅샷(최대 48MB)을 다시 쓰는 구조라 API 호출이 0회여도
디스크 쓰기 총량이 ~50GB. 네트워크 단절로 2회 중단됐지만 체크포인트
재사용 덕에 손실은 없었다. 개선 여지: N건마다 체크포인트(재사용 키 수정
후에는 중단 손실도 없음).

## 다음 단계

- (CI/CD) Jenkins에 `ai-env-file` credential 추가 + Jenkinsfile 복사 라인
  — 현재 Jenkinsfile은 backend/frontend env만 복사해서 새 compose 구조에선
  `OPENROUTER_API_KEY`가 컨테이너에 도달할 경로가 없다.
- (AI) compose ai 서비스에 `INTERNAL_TOKEN` passthrough 추가 — 지금은
  루트 .env에 값을 넣어도 FastAPI에 전달되지 않아, 토큰을 활성화하는 순간
  try-on 콜백이 Spring에서 거부된다.
- (AI+인프라) try-on 결과 이미지 공개 경로 확정 — `/try-on-results`가
  루트에 마운트돼 nginx `/ai/` 프록시로는 외부 접근 불가.
- (AI) 사람 라벨 평가셋 구축, 확장 카탈로그 기준 baseline 재고정,
  candidate_limit(50) 재튜닝.
- 60건 REVIEW_REQUIRED 사이즈 이상치 수동 검수.
