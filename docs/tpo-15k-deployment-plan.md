# TPO 15k 카탈로그 배포 계획 (S3 · EC2) — 실행 완료

- 작성일: 2026-08-05 / **실행 완료: 2026-08-06**
- Go 조건 충족: 팀 평가 macro 0.772 → 0.927 (커밋 d382bc5)

## 실행 결과 기록 (2026-08-06)

| 단계 | 결과 |
|---|---|
| S3 업로드 | 신규 13,201 + 기존 1,991 skip, 충돌 0. 오프라인 enriched manifest와 키·URL 불일치 0 |
| EC2 DB 시드 | 15,192 상품 / 44,775행, `--store-object-key`(신설, f6791cd)로 **키 형태 저장**(절대 URL 0), 백업 `ec2-db-backup-before-15k.json`, id 1129~18311 |
| 스냅샷 재발행 | EC2 id 기준, **embedded_count=0 / reused 15,192** (input_sha256 재사용), SHA `0435f77b…` |
| 배치 | workspace 마운트 경로 + `/opt/gordi/ai/catalog_index` 양쪽, 파일 SHA 로컬↔EC2 일치, 구 스냅샷 `.bak` 보존 |
| 전환·스모크 | gordi-ai 재기동, health(`/ai/v1/health`) OK, `/rank` + `tpo` 필드 200, VLM 리랭크 failed=0 (6.6s) |

비고: EC2 컨테이너에 OPENROUTER 키·INTERNAL_API_KEY·리랭크 플래그가
CI/CD 경로로 반영돼 있음을 확인(무키 요청 401 정상). API prefix는
`/ai/v1`.
- 선행 산출물 (로컬 완료분):
  - seed manifest: `ai/garment_dataset-v2/reports/gordi-product-seed-tpo15k.json` (15,192 상품 / 44,775 사이즈 행)
  - 오프라인 enriched manifest: `...-enriched.json` (S3 키·URL 사전 계산, 업로드 안 함)
  - TPO 태그 사이드카: `ai/garment_dataset-v2/reports/tpo-tags-v1.jsonl`
  - 로컬 스냅샷: `ai/catalog_index/catalog-embeddings.json` (15k, TPO 태그 포함)

## 실행 전 확인 (Go 조건)

1. 팀 쿼리 평가에서 15k 카탈로그 채택 결정.
2. `tpo-tags-v1.jsonl` Git 커밋 여부 결정 — 자체 생성물(크롤링 파생
   아님)이라 커밋 권장(~5MB). 커밋하지 않으면 EC2 반입은 scp.

## 절차

### 1. S3 업로드

```powershell
# ai/ 에서, AWS_* 와 GARMENT_S3_BUCKET, GARMENT_IMAGE_BASE_URL 설정 후
python -m garment_collector upload-s3 `
  --manifest garment_dataset-v2/reports/gordi-product-seed-tpo15k.json `
  --dataset-root garment_dataset-v2 `
  --output garment_dataset-v2/reports/gordi-product-seed-tpo15k-uploaded.json `
  --dry-run
# preflight 통과 확인 후 --dry-run 제거하고 실행
```

- 기존 1,991건 객체는 멱등 skip (같은 키·해시).
- **업로드 후 정합 검증**: uploaded manifest의 `image_url`/`s3_object_key`가
  로컬 enriched manifest와 완전 일치해야 한다 (키는 콘텐츠 주소라
  일치가 보장되지만 반드시 diff로 확인):

```bash
python - <<'EOF'
import json
a = json.load(open('garment_dataset-v2/reports/gordi-product-seed-tpo15k-enriched.json', encoding='utf-8'))
b = json.load(open('garment_dataset-v2/reports/gordi-product-seed-tpo15k-uploaded.json', encoding='utf-8'))
mism = [
    (x['external_id'])
    for x, y in zip(a['products'], b['products'])
    if x['image_url'] != y['image_url'] or x['primary']['s3_object_key'] != y['primary']['s3_object_key']
]
print('mismatch:', len(mism))
EOF
```

- 불일치 0이면 **로컬 DB·스냅샷을 그대로 신뢰**할 수 있다 (재시드 불필요).

### 2. EC2 DB 시드

runbook(`docs/garment-seed-ec2-runbook.md`) 절차를 따르되:

- SSH 터널 경유 시 **타임아웃을 40분 이상**으로 잡을 것. 이전
  1,991+6.5k행이 약 14,500 statement/5분이었고, 이번엔 15,192+44,775행으로
  약 8배 규모다 (총 statement 수 × 터널 RTT로 먼저 추정 — 8/4 교훈).
- dry-run → 백업 확인 → apply. 트랜잭션이라 중단 시 롤백 안전.
- 시드 후 검증: 상품 수 15,192(+기존 유지분), 한글 깨짐, image_url
  prefix, **shoulder_width/hip_width NULL 행 존재 확인**(완화 정책 정상 반영).

### 3. EC2 스냅샷 재발행

- EC2 DB의 auto-increment id로 재발행해야 한다 (스냅샷 product_id는
  DB별 바인딩 — 로컬 스냅샷 복사 금지, 8/4 설계 결정 1).
- **반드시 같은 `--tpo-tags` 사이드카를 지정할 것.** 임베딩 문서에
  태그가 포함되므로, 사이드카 없이 재발행하면 input_sha256이 달라져
  15k 전량 유료 재임베딩된다. 사이드카를 지정하면 로컬 체크포인트
  재사용으로 **임베딩 API 호출 0회**여야 정상.

```powershell
python -m app.recommendation.embedding_cli `
  --output catalog_index/catalog-embeddings.json `
  --tpo-tags garment_dataset-v2/reports/tpo-tags-v1.jsonl
# (로컬 완료 스냅샷/체크포인트를 EC2 작업 위치에 먼저 복사)
```

- 실행 중 체크포인트 파일 열지 말 것 (WinError 5 — 진행 확인은 파일 크기).
- report의 `embedded_count`가 0이 아니면 즉시 중단하고 원인 확인
  (해시 불일치 = 과금 발생 중).

### 4. 인덱스 배치·전환

- `/opt/gordi/ai/catalog_index/`와 현 컨테이너 마운트 경로 양쪽 배치
  (8/4 결정 3), SHA-256 로컬↔EC2 일치 확인, 컨테이너 재기동 후
  health + `/rank` 스모크(TPO 문장 포함 질의로).
- 이전 스냅샷은 `catalog-embeddings-2k-<sha8>.bak.json`으로 보존 (롤백용).

### 5. 롤백 기준

- `/rank` p95가 기존 대비 유의미 악화, 또는 스모크에서 TPO 질의
  결과가 무의미할 때: 이전 스냅샷 파일로 되돌리고 컨테이너 재기동
  (DB는 되돌릴 필요 없음 — 스냅샷만 랭킹에 관여).

## 주의: 이 계획이 하지 않는 것

- Jenkins credential/env 반영은 CI/CD 담당자 경계 (8/4 결정 2).
- 백엔드 try-on의 NULL 실측 가드·"실측 수치 없음" 표시는 별도 작업.
