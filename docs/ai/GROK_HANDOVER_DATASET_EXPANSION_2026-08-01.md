# Grok Build 핸드오버: 의류 데이터셋 확장 수집

- 작성일: 2026-08-01
- 개정: 2026-08-01 (정책 v1.1, collector 2.1.0)
- 대상 저장소: `S15P11D105`, 작업 디렉터리 `ai/`
- 목적: 카탈로그를 **성별×상하의 셀당 500개(총 2000)** 규모로 확장
- 수집기: `ai/garment_collector/` (collector 2.1.0+)

## 0. 배경 요약

- 추천 파이프라인은 상품 ~198개 시드(남/여 × TOP/BOTTOM 약 50씩) 기준으로
  구축·평가됐다. 변별력이 낮아 확장 후 임베딩 재구축·재평가가 예정되어 있다.
- 수집기는 무신사 goods-detail API(스토어프론트 JSON)를 사용하며,
  상품 상세 + 실측 사이즈(+ 필요 시 options)를 raw bundle로 저장하고
  primary 이미지 1장을 내려받아 정규화 JSON(`garment-dataset-v2`)을 만든다.
  **신규 수집은 곧바로 v2** 이므로 reprocess 불필요.

## 1. 절대 규칙 (위반 시 수집 중단)

근거: [garment-data-collection-policy-v1.md](garment-data-collection-policy-v1.md) **v1.1.0**,
정책 예외 `mvp-internal-eval-v1` (내부 평가 한정).

1. **상품 간 간격 3.0초 미만으로 낮추지 않는다.** (`product_delay_sec` 하드 하한)
   - 같은 상품의 actual-size / options 는 상품 간 대기를 다시 적용하지 않는다
     (intra-product unpaced). 이 최적화를 되돌려 “모든 GET에 3초”로 강제할
     필요는 없다.
2. **이미지 간격 1.0초 미만으로 낮추지 않는다.**
3. **동시성 1.** 수집 프로세스를 둘 이상 병렬로 돌리지 않는다.
4. **403 / 429 / 503** 또는 차단 페이지 → 수집기가 run 전체를 멈춘다.
   그대로 종료·보고. 헤더 변조·프록시·우회 재시도 금지.
   수 시간 이상 대기 후 팀 확인 하에 **같은 명령을 재실행** (`--skip-existing`).
5. 재시도 최대 2회 — 코드 기본값 유지.
6. **수집 데이터(raw/이미지/정규화 JSON)는 Git에 커밋하지 않는다.**
7. 리뷰·구매자·닉네임 등 UGC/개인정보 수집 금지.
8. 이미지 권리: `internal-evaluation-only-unverified` — 외부 공개·재배포·학습 전환 금지.

### 1.1 run 상한

**run당 200개 상한은 제거됐다.** `--max-items`는 선택적 안전장치일 뿐 기본 무제한.
하룻밤에 수천 ID를 한 번에 넣어도 된다 (네트워크·차단 리스크는 동일).

## 2. 확장 목표

| 셀 | 목표 |
|---|---:|
| MALE/TOP | 500 |
| MALE/BOTTOM | 500 |
| FEMALE/TOP | 500 |
| FEMALE/BOTTOM | 500 |
| **합계** | **2000** |

기존 정규화 분(~수백)은 `--skip-existing`으로 건너뛴다.  
ID 목록을 준비할 때 셀 균형을 맞추고, 서브카테고리 편중을 피한다.

**상품군 분류 규칙 (파서 자동):**

| 상품군 | 저장 분류 |
|---|---|
| 스커트 | BOTTOM / SKIRT |
| 원피스·드레스 | TOP / DRESS |
| 아우터(재킷·코트·가디건·패딩) | TOP / JACKET·COAT·CARDIGAN·PADDING |

## 3. 환경 준비

```powershell
cd ai
# venv 이미 있으면 생략
python -m venv .venv
.\.venv\Scripts\pip install -r requirements-garment-tools.txt
$tmp = "$env:TEMP\grok-pytest-tmp"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
.\.venv\Scripts\python -m pytest tests/test_garment_collector_collect.py -p no:cacheprovider --basetemp=$tmp -q
```

네트워크 자격증명 불필요 (공개 스토어프론트 API).

## 4. ID 목록 준비

수집기는 **상품 상세 수집**에 ID 목록만 받는다. 다만 목록 확보용으로
공개 PLP 리스트 API를 느린 간격으로 조회하는 `scripts/discover_plp_ids.py`
를 둔다 (상세 수집과 분리, 페이지 간 ≥1.0s, 403/429/503 시 중단).

ID = 무신사 URL `musinsa.com/products/{id}` 숫자.

### 4.1 이미 준비된 배치 (2026-08-01)

```text
ai/batches/
  README.md
  male_top.txt          # 624 new
  male_bottom.txt       # 546 new
  female_top.txt        # 671 new
  female_bottom.txt     # 637 new
  overnight_all.txt     # 2478 unique new (합본)
  discover-report.json
  expected-counts-500.json
```

기존 normalized ID는 discover 단계에서 제외됨. 재생성:

```powershell
.\.venv\Scripts\python scripts\discover_plp_ids.py `
  --dataset-root garment_dataset-v2 --out-dir batches `
  --target-per-cell 500 --oversample 1.6 --page-delay 1.5
```

ids 파일 형식:

```text
# batch: MALE/TOP
4123456
4234567  # 주석 가능
```

중복 ID는 CLI가 순서 보존 de-dupe 한다.

## 5. 수집 실행 (로컬 밤새)

작업 디렉터리는 항상 `ai/`.

### 5.1 dry-run

```powershell
.\.venv\Scripts\python -m garment_collector collect `
  --ids-file batches/overnight_all.txt `
  --dataset-root garment_dataset-v2 `
  --skip-existing --dry-run
```

### 5.2 본 수집 (권장: 스크립트)

```powershell
# 로그 + 타임스탬프 리포트 아카이브 포함
.\scripts\collect_overnight.ps1 -IdsFile batches/overnight_all.txt
```

스크립트가 하는 일:

1. `collect --skip-existing` 실행
2. stdout/stderr를 `garment_dataset-v2/reports/overnight/collect-*.log`에 기록
3. 종료 후 `collection-run.json`을 타임스탬프 복사
4. exit code 전달 (3 = 차단 stop)

수동 한 줄:

```powershell
.\.venv\Scripts\python -m garment_collector collect `
  --ids-file batches/overnight_all.txt `
  --dataset-root garment_dataset-v2 `
  --skip-existing
```

### 5.3 예상 시간 (collector 2.1)

| 요인 | 내용 |
|---|---|
| 상품 간 | ≥ 3.0s (첫 product API) |
| 상품 내 | actual-size·options 는 추가 3s 대기 없음 |
| options | 실측/상세에 사이즈 있으면 **요청 생략** |
| 이미지 | ≥ 1.0s, primary 1장 |

대략 **12–16초/신규 상품** (네트워크 편차 있음).  
신규 1500개 가정 시 **약 5–7시간** 수준. 기존 skip 분은 거의 즉시.

### 5.4 중단·재개

- `stopped: true` → `stop_reason` 보고, **즉시 재시도 금지**. 수 시간 후 동일 명령 재실행.
- `failed` 개별 ID는 전체를 막지 않음. 로그/리포트에서 모아 다음날 재시도 목록 작성.
- PC 절전 해제, 뚜껑 닫아도 깨우지 않기, 안정 전원 권장.

## 6. 결과 확인

```powershell
# 마지막 run 요약
Get-Content garment_dataset-v2\reports\collection-run.json -Raw | ConvertFrom-Json |
  Select-Object requested, succeeded, failed, skipped, stopped, stop_reason

# 전체 재검증
.\.venv\Scripts\python -m garment_collector validate `
  --dataset-root garment_dataset-v2 --write

# 성별×카테고리 분포 집계 (간단)
.\.venv\Scripts\python scripts\summarize_dataset_cells.py --dataset-root garment_dataset-v2
```

`invalid` 0 목표. `review_required`는 정상(수동 검수 대기).

## 7. 완료 보고 형식

- requested / succeeded / failed / skipped / stopped / stop_reason
- 실패 ID·사유 샘플
- validate 요약
- 셀별 개수 vs 목표 500

## 8. 수집 이후 (사람/후속 세션)

1. 수동 검수 → READY  
2. selection 파일 (`MALE/TOP` 등 그룹 ID)  
3. `export-seed --expected-counts-file` + `--expected-size-rows`  
4. S3 / DB seed ([garment-seed-ec2-runbook.md](garment-seed-ec2-runbook.md))  
5. 임베딩 재구축 → 평가 시드 재생성

## 9. 2026-08-01 collector 변경 요약

| 항목 | 내용 |
|---|---|
| 버전 | 2.0.0 → **2.1.0** |
| run 상한 | 200 하드캡 **제거** (`--max-items` 옵션만) |
| B-1 | product delay = **상품 간** 3.0s; 동일 상품 부가 API unpaced |
| B-2 | sizes 확보 시 **options 스킵** |
| 목표 | 셀당 **500** / 총 2000 |

## 10. 하지 말 것

- 상품 간 3.0s / 이미지 1.0s 하한 완화
- 동시 워커·다중 프로세스 수집
- 차단 후 즉시 재시도·우회
- `garment_dataset*` 를 Git 커밋
- 로그인·CAPTCHA 페이지 접근
- 리뷰/스냅/코디로 수집 범위 확대

## 관련 문서

- [수집 정책 v1.1](garment-data-collection-policy-v1.md)
- [EC2 seed runbook](garment-seed-ec2-runbook.md)
- [2026-08-01 AI 회고](2026-08-01_ai_recommendation_daily_retrospective.md)
