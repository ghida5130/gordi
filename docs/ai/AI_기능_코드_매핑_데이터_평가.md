# AI 기능 ↔ 코드 매핑 — 데이터·평가 편

> 서비스 런타임 밖에서 도는 오프라인 파이프라인 — 데이터 수집·검수·시드,
> 임베딩 스냅샷 빌드, 평가 체계 — 와 코드의 대응표입니다.
> 런타임 기능은 [AI_기능_코드_매핑_런타임_서비스.md](AI_기능_코드_매핑_런타임_서비스.md) 참고.
> 경로는 저장소 루트 기준입니다. (작성: 2026-08-06)

## 1. 의류 데이터 수집·검수 파이프라인 (`ai/garment_collector/`)

무신사 상품을 정책에 따라 수집하고, VLM 검수·TPO 태깅을 거쳐 서비스 투입
가능한 상태(READY)로 만드는 CLI 도구 모음. `python -m garment_collector <command>`.

```
[수집] PLP 상품 ID 발견 → 상세·이미지 수집 → RAW 저장 → 검증 → normalized JSON
   │     ai/scripts/discover_plp_ids.py           ← 수집 계획(plan JSON)대로 ID 수집
   │     ai/garment_collector/pipeline.py         ← collect 파이프라인 본체
   │     ai/garment_collector/rate_limit.py       ← 정책 강제 (상품 간 3초, 403/429/503 즉시 중단)
   ▼
[검수] VLM 이미지 자동 검수 (단독 상품컷인지, 모델 착용/오염 여부)
   │     ai/garment_collector/image_review.py     ← review-images 명령
   │     ai/garment_collector/validate.py         ← 스키마·실측 검증 → READY/REVIEW_REQUIRED/INVALID
   ▼
[태깅] VLM TPO 태깅 (READY 상품 → 한국어 TPO 태그·캡션 사이드카)
   │     ai/garment_collector/tpo_tagging.py      ← tag-tpo 명령, AI 내부 사이드카 jsonl
   ▼
[내보내기] 검수 통과분만 시드 manifest로 추출
         ai/garment_collector/seed_manifest.py    ← export-seed 명령 (불완전 사이즈 행은 드랍)
```

| 파일 | 역할 | 알아둘 점 |
|---|---|---|
| `ai/garment_collector/cli.py`, `__main__.py` | CLI 진입점 | collect / validate / review-images / tag-tpo / reprocess / export-seed / upload-s3 / seed-db |
| `ai/garment_collector/config.py` | 정책 상수 | [garment-data-collection-policy-v1.md](garment-data-collection-policy-v1.md) v1.1.0을 코드로 강제 |
| `ai/garment_collector/adapters/` | 소스별 어댑터 | 무신사 파싱 로직 격리 |
| `ai/garment_collector/models.py`, `storage.py` | 레코드 스키마·저장 | raw bundle 해시(sha256)로 원본 추적 |
| `ai/garment_collector/reprocess.py` | v2 오프라인 재처리 | 네트워크 0회, 원본/출력 경로 분리 강제 |
| `ai/garment_collector/image_review.py` | VLM 자동 검수 | 수동 검수 병목을 대체 — 1,812건 승격 실적 |
| `ai/garment_collector/tpo_tagging.py` | VLM TPO 태깅 | 일시 실패 1회 재시도, 결과는 임베딩 문서에 병합됨 |
| `ai/scripts/start_collect_detached.ps1`, `watch_collect_and_postprocess.ps1` | 분리 수집·감시 | 야간 수집 자동 재기동 + 후처리 (TPO 확장 4일 수집에 사용) |
| `ai/scripts/summarize_dataset_cells.py` | 셀 분포 요약 | 성별×카테고리 균형 확인 |
| `ai/batches/` | 수집 배치 기록 | plan JSON, ID 목록, discover 리포트 (재현용) |

산출물 위치: `ai/garment_dataset-v2/` (raw/normalized/images/reports — **Git 미커밋**,
보고서·정책 문서만 커밋).

## 2. S3 업로드 · 운영 DB 시드

| 파일 | 역할 | 알아둘 점 |
|---|---|---|
| `ai/garment_collector/s3_uploader.py` | primary 이미지 S3 업로드 | 멱등 (재실행 안전), private 버킷 |
| `ai/garment_collector/mysql_seeder.py` | seed manifest → MySQL | **트랜잭션** (중단 시 롤백), dry-run 지원, `--store-object-key`로 image_url을 S3 키 형태로 저장 (백엔드 규약) |

절차 전체는 [garment-seed-ec2-runbook.md](garment-seed-ec2-runbook.md),
15k 실행 기록은 [tpo-15k-deployment-plan.md](tpo-15k-deployment-plan.md) 참고.
SSH 터널 경유 시 타임아웃을 넉넉히 (15k 시드 실측 기록 참고).

## 3. 카탈로그 임베딩 스냅샷

운영 DB의 상품을 읽어 텍스트+대표 이미지 결합 임베딩(768차원)을 만들고,
런타임이 로드하는 **단일 JSON 스냅샷**으로 저장합니다.

| 파일 | 역할 | 알아둘 점 |
|---|---|---|
| `ai/app/recommendation/catalog.py` | 백엔드 MySQL에서 카탈로그 읽기 | 읽기 전용 |
| `ai/app/recommendation/catalog_embeddings.py` | 스냅샷 빌더 | **재개 가능**(체크포인트), 재사용 키는 **입력 해시(input_sha256) 단독** — DB를 옮겨도 재과금 없음. 가격·판매상태는 임베딩 입력에서 제외 |
| `ai/app/recommendation/embedding_cli.py` | 빌드 CLI | TPO 사이드카를 임베딩 문서에 병합 |
| `ai/catalog_index/catalog-embeddings.json` | 결과 스냅샷 | sha256 자가 검증 포함. 15k 기준 372MB — **Git 미커밋** |

운영 주의: 전량 재임베딩은 약 30분 소요. 체크포인트 파일을 열어 진행을
확인하지 말 것(Windows 파일 잠금과 경합) — 파일 크기로만 확인.

## 4. 평가 체계 (3종)

### 4-1. 오프라인 랭킹 평가 — 회귀 감지 기준선

파이프라인을 바꾸기 전 반드시 돌리는 자동 평가. API 호출 없이 결정적으로 동작.

| 파일 | 역할 |
|---|---|
| `ai/app/recommendation/evaluation.py` | 지표 계산 — recall@K, nDCG@K, pairwise 정확도, 브랜드 다양성, latency |
| `ai/app/recommendation/eval_cli.py` | 러너 — `python -m app.recommendation.eval_cli run --dataset eval/queries-seed-v1.jsonl --mode offline` |
| `ai/eval/queries-seed-v1.jsonl` | seed 평가셋 (메타데이터 유도 라벨) |
| `ai/eval/baselines/` | 고정된 baseline 수치 JSON (변경 전후 비교 기준) |

### 4-2. TPO 적합 평가 — 사람 판정

"모집단 자체가 상황(TPO)과 맞는가"를 재는 평가. nDCG로는 못 재는 실패 모드를 잡습니다.

| 파일 | 역할 |
|---|---|
| `ai/app/recommendation/tpo_eval.py` | 쿼리셋 로드, 판정 저장(append-only), macro/micro 집계 |
| `ai/eval/queries-tpo-v1.jsonl` | TPO 쿼리 24개 (포멀/데일리/운동/여행/계절, 남녀 균형) |
| `ai/eval/judgments/tpo-v1.jsonl` | **사람 판정 원본** (3,120건, Git 커밋 대상) — snapshot SHA가 함께 기록되어 카탈로그 버전별 분리 집계 가능 |
| AI 서버 `/demo/tpo-eval` | 팀원용 판정 UI (`ENABLE_RECOMMENDATION_DEMO=true`) |

실적: 2k baseline macro 0.772 → 15k+TPO 태그 0.927. 수치·방법은
[ai/eval/README.md](../../ai/eval/README.md) 참고.

### 4-3. 착장 이미지 모델 블라인드 A/B — `ai/image_demo/`

이미지 생성 모델을 모델명을 가리고 팀원 투표로 선정한 자체 평가 도구.

| 위치 | 역할 |
|---|---|
| `ai/image_demo/backend/` | FastAPI — run 실행, 투표 저장, 집계 (`demo_data/`에 실제 투표 원본) |
| `ai/image_demo/backend/app/evaluation/profiles.py` | 라운드별 평가 프로필 (1차 7모델 / 2차 4모델) |
| `ai/image_demo/backend/app/evaluation/fit.py` | 동적 핏 계산 (실측 vs 아바타 치수) |
| `ai/image_demo/backend/app/evaluation/prompt.py` | PERSON BASE / GARMENT ONLY 프롬프트 생성 — **여기서 검증된 구조가 운영 try-on에 이식됨** |
| `ai/image_demo/frontend/` | React — 블라인드 투표 UI, 결과 대시보드 (`src/round2/Round2DashboardPage.tsx`) |
| `ai/image_demo_local/` | 로컬 이미지 화이트리스트 변형 (네트워크 없이 데모) |

### 4-4. 리랭커 모델 벤치마크

| 위치 | 역할 |
|---|---|
| `ai/eval/benchmarks/2026-08-01-rerank-model-comparison.md` | 6개 비전 모델 × 200판정 비교 → gpt-5.6-luna 채택 근거 |

## 5. 전형적인 작업 절차 모음

```bash
# 파이프라인 변경 전 회귀 확인 (필수)
python -m app.recommendation.eval_cli run --dataset eval/queries-seed-v1.jsonl --mode offline

# 데이터 확장 한 사이클
python -m garment_collector collect ...      # 수집 (정책 준수 자동)
python -m garment_collector validate ...     # 검증
python -m garment_collector review-images .. # VLM 검수
python -m garment_collector tag-tpo ...      # TPO 태깅
python -m garment_collector export-seed ...  # seed manifest 추출
python -m garment_collector upload-s3 ...    # S3 업로드
python -m garment_collector seed-db ... --store-object-key  # DB 시드
python -m app.recommendation.embedding_cli   # 스냅샷 재발행 (재사용 캐시로 신규분만 과금)
```

각 명령의 정확한 옵션은 `--help`와 [garment-seed-ec2-runbook.md](garment-seed-ec2-runbook.md) 참고.
