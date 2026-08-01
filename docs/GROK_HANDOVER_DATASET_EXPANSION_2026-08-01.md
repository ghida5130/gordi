# Grok Build 핸드오버: 의류 데이터셋 확장 수집

- 작성일: 2026-08-01
- 대상 저장소: `S15P11D105`, 작업 디렉터리 `ai/`
- 목적: 현재 198상품 카탈로그를 확장하기 위한 신규 수집 실행
- 수집기: `ai/garment_collector/` (검증된 코드, 이 문서 기준으로 실행만 하면 됨)

## 0. 배경 요약

- 추천 파이프라인은 상품 198개(남 98/여 100, TOP 98/BOTTOM 100) 기준으로
  구축·평가됐다. 데이터셋이 작아 평가 변별력이 낮으므로 확장 후
  임베딩 재구축·재평가가 예정되어 있다.
- 수집기는 무신사 goods-detail API(스토어프론트 JSON)를 사용하며,
  상품 상세 + 실측 사이즈 + 옵션을 하나의 raw bundle로 저장하고
  primary 이미지 1장을 내려받아 정규화 JSON(`garment-dataset-v2` 스키마)을
  만든다. **신규 수집 결과는 곧바로 v2 형식이므로 reprocess 단계는 불필요하다**
  (reprocess는 과거 v1 번들 변환용이었다).

## 1. 절대 규칙 (위반 시 수집 중단)

근거: [garment-data-collection-policy-v1.md](garment-data-collection-policy-v1.md),
정책 예외 `mvp-internal-eval-v1` (내부 평가 한정).

1. **요청 간격을 낮추지 않는다.** 상품 3.0초/이미지 1.0초 미만은 코드가
   거부한다. 이 하한을 우회하는 코드 수정 금지.
2. **run당 200개 상한(`MAX_ITEMS_PILOT`)을 우회하지 않는다.** 더 모으려면
   200개 이하 배치를 나눠 여러 번 실행한다. 상한 자체를 올리는 것은
   정책 문서 개정이 선행돼야 하며 Grok의 권한 밖이다.
3. **403 / 429 / 503 응답이 나오면 수집기가 스스로 멈춘다.** 멈추면
   그대로 종료하고 보고한다. 헤더 변조·프록시·우회 재시도 금지.
   충분한 시간(수 시간 이상)을 두고 팀 확인 후 재개한다.
4. 동시성 1, 재시도 최대 2회 — 코드 기본값을 그대로 둔다.
5. **수집 데이터(raw/이미지/정규화 JSON)는 Git에 커밋하지 않는다.**
   `.gitignore`에 이미 제외되어 있고, 커밋 대상은 코드·문서·집계 보고서뿐이다.
6. 리뷰·구매자 정보·닉네임 등 개인정보와 사용자 생성 콘텐츠는 수집하지
   않는다 (수집기가 애초에 안 가져오지만, 코드 수정 시에도 금지).
7. 이미지 권리 상태는 `internal-evaluation-only-unverified` — 외부 공개·
   재배포·학습 전환 금지.

## 2. 환경 준비

로컬 Python 3.13 기준 (Docker `Dockerfile.garment-tools`로도 동일 실행 가능):

```bash
cd ai
python -m venv .venv           # 이미 있으면 생략
.venv/Scripts/pip install -r requirements-garment-tools.txt
.venv/Scripts/python -m pytest tests/test_garment_collector_collect.py -q   # 스모크
```

네트워크 자격증명 불필요 (수집 자체는 공개 스토어프론트 API).

## 3. 입력: 상품 ID 목록 준비

수집기는 **ID 목록 입력만** 받는다. 카테고리 목록 크롤링 기능은 정책상
의도적으로 없다. ID는 무신사 상품 URL의 숫자
(`musinsa.com/products/{id}`)이다.

- 팀에서 전달받거나, 브라우저로 카테고리 페이지를 보며 수동으로 추린다.
- 균형 목표(권장): 확장분도 남/여 × TOP/BOTTOM을 비슷한 비율로,
  서브카테고리별 최소 8개 이상(평가셋 anchor 그룹 최소 크기 4의 여유분).
- 기존 수집분과 겹쳐도 된다 — `--skip-existing`이 걸러준다.

**상품군 분류 규칙 (팀 확정, 파서가 자동 적용):** 백엔드 카탈로그는
TOP/BOTTOM 두 카테고리만 저장한다.

| 상품군 | 저장 분류 |
|---|---|
| 스커트 | BOTTOM / SKIRT |
| 원피스·드레스 | TOP / DRESS |
| 아우터(재킷·코트·가디건·패딩) | TOP / JACKET·COAT·CARDIGAN·PADDING |

따라서 스커트·원피스·아우터 상품 ID도 수집 대상에 포함해도 된다.
분류 사유는 `temporary_classification_reason`에 기록되므로 별도 처리 불필요.

ids 파일 형식 (한 줄 하나, `#` 주석 허용):

```text
# batch01: MALE/TOP 셔츠
4123456
4234567  # 무지 옥스포드 셔츠
```

## 4. 수집 실행 절차

배치 파일 하나(≤200개)당 아래 순서로 실행한다.
작업 디렉터리는 항상 `ai/`.

```bash
# 1) dry-run: ID 파싱과 개수만 확인 (네트워크 없음)
.venv/Scripts/python -m garment_collector collect \
  --ids-file batches/batch01.txt \
  --dataset-root garment_dataset-v2 \
  --skip-existing --dry-run

# 2) 본 수집 (200개 배치 기준 약 15~25분 소요; 요청 간격 때문에 정상)
.venv/Scripts/python -m garment_collector collect \
  --ids-file batches/batch01.txt \
  --dataset-root garment_dataset-v2 \
  --skip-existing

# 3) 결과 확인
#   garment_dataset-v2/reports/collection-run.json 의
#   succeeded/failed/skipped/stopped 확인
```

- `stopped: true`면 `stop_reason`을 보고하고 그 배치를 중단한 채 대기.
  재개는 **같은 명령을 그대로 다시 실행** — `--skip-existing`이 완료분을
  건너뛰므로 이어서 수집된다.
- 개별 상품 `failed`(파싱 실패·이미지 없음 등)는 전체를 막지 않는다.
  실패 ID와 사유를 모아 마지막에 보고한다.
- `excluded`는 MVP 범위 밖 상품(파서가 판정)이므로 정상 동작이다.

모든 배치가 끝나면 전체 재검증:

```bash
.venv/Scripts/python -m garment_collector validate \
  --dataset-root garment_dataset-v2 --write
```

`invalid`가 0이어야 한다. `review_required`는 정상(사람 검수 대기 상태).

## 5. Grok의 완료 보고 형식

수집 종료 시 다음을 정리해 보고한다.

- 배치별 requested / succeeded / failed / skipped / excluded / stopped 여부
- 실패 ID 목록과 사유
- validate 요약 (validated / review_required / invalid 수)
- 신규 수집 상품의 성별×카테고리 분포 (normalized JSON의
  `product.gender`, `product.backend_category` 집계)

## 6. 수집 이후 파이프라인 (참고 — 사람/후속 세션 담당)

Grok의 범위는 4장까지다. 이후 흐름은 다음과 같으며 각 단계는 기존 문서에
절차가 있다.

1. **수동 검수**: 신규 항목의 primary 이미지에 대해 `view`,
   `reference_type`, `model_present`, `other_garments_present`를 채우고
   `validation.status=READY` + `reviewer`를 기록해야 READY가 된다
   (warnings가 남아 있으면 validate가 READY를 유지하지 않음).
2. **selection 파일 작성**: `{"ids": {"MALE/TOP": [...], ...}}` 형식으로
   확장 세트를 확정.
3. **seed manifest export** — 오늘 추가된 확장 옵션 사용:
   ```bash
   python -m garment_collector export-seed \
     --dataset-root garment_dataset-v2 \
     --selection-file reports/selection-v2.json \
     --output reports/gordi-product-seed-v2.json \
     --expected-counts-file reports/expected-counts-v2.json \
     --expected-size-rows <실측 행 수>
   ```
   (`expected-counts-v2.json` = `{"MALE/TOP": ..., ...}` 그룹별 개수)
4. **S3 업로드 / DB seed**: [garment-seed-ec2-runbook.md](garment-seed-ec2-runbook.md)
   절차 그대로 (dry-run → backup → apply).
5. **임베딩 재구축**: `embedding_cli`는 checkpoint의 입력 해시로 기존
   항목을 재사용하므로 추가분만 임베딩된다. 완료 후 snapshot
   `COMPLETE`/개수/SHA 확인.
6. **평가 재고정**: `eval_cli generate-seed`로 평가셋 재생성 후
   오프라인 baseline을 새로 기록 ([ai/eval/README.md](../ai/eval/README.md)).

## 7. 오늘 수집기에 반영된 변경 (2026-08-01)

1. `collect --skip-existing` — normalized JSON이 이미 있는 ID는 네트워크
   요청 없이 skip. 차단 후 재개·배치 중복 실행을 안전하게 만든다.
2. `export-seed --expected-counts-file / --expected-size-rows` — 기존에는
   198개 구성이 하드코딩되어 확장 데이터셋을 export할 수 없었다.
   두 옵션은 반드시 함께 지정한다.

둘 다 단위 테스트 포함 (`ai/tests/test_garment_collector_collect.py`).

## 8. 하지 말 것 (재강조)

- 요청 간격·상한·중단 정책을 완화하는 코드 수정
- 차단(403/429/503) 후 즉시 재시도 또는 우회
- `garment_dataset*`, 이미지, manifest, tar를 Git에 커밋
- 로그인·세션·CAPTCHA가 필요한 페이지 접근
- 수집 범위를 리뷰/스냅/코디 게시물로 확대

## 관련 문서

- [수집 정책 v1](garment-data-collection-policy-v1.md)
- [2026-07-31 카탈로그 seed 진행 보고](2026-07-31_garment_catalog_seed_progress_report.md)
- [EC2 seed runbook](garment-seed-ec2-runbook.md)
- [2026-08-01 AI 회고 (파이프라인 현황)](2026-08-01_ai_recommendation_daily_retrospective.md)
