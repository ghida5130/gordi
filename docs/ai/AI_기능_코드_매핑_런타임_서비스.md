# AI 기능 ↔ 코드 매핑 — 런타임 서비스 편

> 서비스가 도는 동안 실제로 실행되는 기능과 코드의 대응표입니다.
> 오프라인 파이프라인(데이터 수집·임베딩·평가)은
> [AI_기능_코드_매핑_데이터_평가.md](AI_기능_코드_매핑_데이터_평가.md) 참고.
> 경로는 저장소 루트 기준입니다. (작성: 2026-08-06)

## 0. 서버 공통 구조

FastAPI 앱 하나가 외부(데모)용 라우터와 Spring 전용 내부 라우터를 함께 서빙합니다.

| 파일 | 역할 |
|---|---|
| `ai/run.py` | 로컬 실행 진입점 (uvicorn) |
| `ai/app/main.py` | FastAPI 앱 조립, 라우터 등록 |
| `ai/app/api/router.py` | 공개 라우터 — health, (플래그 시) 추천 데모 |
| `ai/app/api/internal_router.py` | **Spring 전용** `/internal/v1` 라우터 — 추천 rank, try-on |
| `ai/app/core/config.py` | 환경변수 설정 (`ai/.env` 우선, 공유 값만 루트 `.env`) |
| `ai/app/core/security.py` | 내부 API 키 인증 (`X-Internal-Api-Key`) |
| `ai/app/schemas/recommendation.py` | /rank 요청·응답 스키마 (camelCase 계약) |
| `ai/app/schemas/tryon.py` | try-on 요청·이벤트 스키마 |
| `ai/tests/` | pytest 스위트 (기능별 test_*.py, 200+ 테스트) |

## 1. 맞춤 의상 추천 — `POST /internal/v1/recommendations/rank`

Spring이 후보 상품 목록과 조건(성별·예산·무드·**TPO 자유 텍스트**)을 보내면
AI가 순위를 매겨 돌려주는, 추천의 메인 경로입니다.

### 처리 흐름과 담당 파일

```
RankRequest (condition: gender/budget/moods/tpo + candidates)
  │  ai/app/api/routes/internal_recommendations.py   ← 엔드포인트, 폴백 결정
  ▼
[1] 쿼리 임베딩 — condition 텍스트(무드+TPO)를 768차원 벡터로
  │  ai/app/recommendation/catalog_embeddings.py     ← OpenRouter 임베딩 클라이언트
  ▼
[2] 벡터 유사도 — 후보 상품의 스냅샷 임베딩과 코사인 계산
  │  ai/app/recommendation/vector_index.py           ← 인메모리 인덱스 (numpy float64 행렬)
  │  ai/app/services/recommendation_pipeline.py      ← 인덱스 lazy 로드(lru_cache) + 실패 60s backoff
  ▼
[3] 규칙 기반 궁합 — 색상·계절·스타일·TPO 태그 매칭 점수
  │  ai/app/recommendation/pipeline.py               ← RuleBasedCompatibilityModel, intent 파싱
  ▼
[4] (opt-in) VLM pairwise 리랭크 — 상위 후보를 비전 모델이 재판정
  │  ai/app/recommendation/vlm_reranker.py           ← 병렬 판정, 실패 시 규칙 점수 유지
  ▼
[5] 최종 점수 = retrieval 0.65 + compatibility 0.35 → RankResponse
     ai/app/services/vector_ranker.py                ← 위 단계를 /rank 계약으로 묶는 오케스트레이터
```

### 파일별 상세

| 파일 | 역할 | 알아둘 점 |
|---|---|---|
| `ai/app/api/routes/internal_recommendations.py` | /rank 엔드포인트 | 벡터 랭커 실패 시 **키워드 baseline으로 자동 폴백** — 추천은 절대 죽지 않음 |
| `ai/app/services/vector_ranker.py` | 벡터 기반 랭커 본체 | 후보별 임베딩은 `embedding_by_product_id`(해시 조회), opt-in 리랭커 통합 |
| `ai/app/services/recommendation_ranker.py` | 결정적 키워드 baseline | 예산 적합도 + 무드 키워드 일치, 폴백 최후 보루 |
| `ai/app/services/recommendation_pipeline.py` | 런타임 조립 | 스냅샷 로드는 첫 요청 1회(lru_cache), **로드 실패도 60초 기억**해 요청마다 재파싱 방지 (8/6 장애 재발 방지) |
| `ai/app/recommendation/vector_index.py` | 벡터 인덱스 | 스냅샷 JSON 검증(sha256, 스키마) 후 numpy 행렬로 상주. 성별·카테고리·예산 **사전 필터 → 행렬 내적** (15k 최악 25ms) |
| `ai/app/recommendation/pipeline.py` | 규칙 기반 두뇌 | 질의 intent 파싱, 상품 태그 추론, 궁합 점수, **근거 기반 추천 이유**(GroundedReasonGenerator) |
| `ai/app/recommendation/vlm.py` | OpenAI 호환 chat 클라이언트 | OpenRouter ↔ 로컬 Ollama/vLLM을 endpoint 교체만으로 전환 |
| `ai/app/recommendation/vlm_reranker.py` | VLM pairwise 리랭크 | 판정 병렬(기본 20 동시), 구조화 출력, 실패 판정은 규칙 점수로 강등 |
| `ai/app/recommendation/llm_reasons.py` | LLM 추천 이유 | 검증된 사실만 프롬프트에 넣고, 사실에 없는 태그가 나오면 **환각으로 폐기** |
| `ai/app/recommendation/image_attributes.py` | 쿼리 이미지 속성 추출 | closed vocabulary 밖 값 폐기 |
| `ai/app/recommendation/image_fetcher.py` | 이미지 fetch | **호스트 allowlist 기반 SSRF 방어** (쿼리·상품 이미지 공용) |

설계 원칙: VLM 기능(속성 추출·리랭크·추천 이유)은 전부 **플래그 opt-in**이고,
어느 단계가 실패해도 규칙 기반으로 자동 강등됩니다. 플래그 목록은
[ai/README.md](../../ai/README.md) 참고.

### 데모 검색 — `POST /search` + 데모 페이지

| 파일 | 역할 |
|---|---|
| `ai/app/api/routes/recommendation_demo.py` | 로컬 전용 데모 페이지·업로드 API (`ENABLE_RECOMMENDATION_DEMO=true`) |
| `ai/app/static/recommendation_demo.html` | 데모 UI — 파이프라인 진행을 NDJSON 스트리밍으로 실시간 표시 |

## 2. 가상 피팅 (Try-on) — `POST /internal/v1/try-on`

아바타 + 선택 의상(사이즈 포함)으로 착장 이미지를 생성합니다.
**202 즉시 접수 후 백그라운드 생성 → Spring에 이벤트 콜백** 구조.

```
Spring → POST /internal/v1/try-on (202 접수, job_id 멱등)
  │  ai/app/api/routes/internal_tryon.py    ← 접수·중복 방지·job 상태 조회(GET /{job_id})
  ▼
백그라운드 처리                               ai/app/services/tryon_jobs.py
  1. PROCESSING 이벤트를 Spring에 콜백
  2. 아바타 사진 + 의상 primary 사진 fetch (SSRF allowlist 동일 적용)
  3. 핏 인지 프롬프트 조립 — 블라인드 평가로 검증한 역할 분리:
     PERSON BASE(인물·체형·포즈의 유일한 기준) / GARMENT ONLY(색·패턴·소재·컷만)
     + 선택 사이즈 실측치 vs 아바타 기준 치수 → 상대 핏 태그(TIGHT/REGULAR/…)
  4. OpenRouter로 1장 생성 (기본 Nano Banana 2, gemini-3-pro-image)
  5. SUCCEEDED(결과 URL) / FAILED(재시도 가능 여부 분류) 콜백
```

| 파일 | 역할 | 알아둘 점 |
|---|---|---|
| `ai/app/api/routes/internal_tryon.py` | 접수 엔드포인트 | job_id 중복 접수는 성공 응답만 (멱등). 서버 재시작으로 잊힌 job은 404 → Spring 정합 복구 worker가 마감 |
| `ai/app/services/tryon_jobs.py` | job 처리 본체 | 프롬프트 조립·생성·콜백·실패 분류가 모두 여기 |
| `ai/app/schemas/tryon.py` | 계약 스키마 | Spring과의 이벤트 계약 (PROCESSING → SUCCEEDED/FAILED) |
| `ai/tryon_results/` | 생성 결과 로컬 보관 (개발용) | |

## 3. 아바타 프리셋

아바타는 **런타임 AI 생성이 아니라 사전 제작 프리셋**입니다. 성별(2) × 키 구간 ×
몸무게 구간 (× 체형) 그리드로 이미지 생성 모델이 일괄 생성 → 검수 → S3 업로드.
서비스 중에는 사용자의 키·몸무게·체형 입력을 매핑 규칙으로 프리셋에 대응시키고
(담당: 백엔드), AI 서버는 try-on 때 그 아바타 이미지를 **PERSON BASE 입력**으로,
프리셋별 기준 신체 치수를 **핏 계산 기준**으로 사용합니다.

| 위치 | 역할 |
|---|---|
| `ai/avatar_references/` | 프리셋 참조 이미지 로컬 사본 (원본은 S3 — Git 미커밋) |
| `ai/app/services/tryon_jobs.py` | 프리셋 치수 vs 의상 실측 비교 → 상대 핏 태그 계산 |

## 4. 장애·성능 관련 상식 (운영자용)

- **스냅샷 로드는 첫 요청 때 1회** — 372MB JSON 파싱에 EC2 기준 ~25초.
  재시작 직후 첫 /rank가 느린 건 정상이며, 배포 스모크에 워밍업 요청 1회 권장.
- 로드 실패는 60초 backoff 동안 기억되어 즉시 baseline으로 강등 (요청마다
  재파싱하다 타임아웃 연쇄를 일으킨 8/6 장애의 재발 방지).
- 벡터 검색은 numpy 행렬 내적으로 15k 전량 스캔도 최악 ~25ms(로컬 실측,
  EC2 ~60ms). 인덱스 상주 메모리는 프로세스 기준 ~850MiB, 로드 순간 피크 ~1.8GiB.
- 관련 회고: [2026-08-04_ai_ec2_deployment_retrospective.md](2026-08-04_ai_ec2_deployment_retrospective.md),
  [발표자료용_AI_기능_구축_정리.md](발표자료용_AI_기능_구축_정리.md) ④ 트러블슈팅.
