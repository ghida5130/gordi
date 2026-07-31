# Gordi AI API

FastAPI 기반 AI 서버입니다. `app/core/config.py`가 모노레포 루트의 `.env`를 직접 읽습니다.

## 실행

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

기본 주소:

- API: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/v1/health`

## 백엔드 내부 추천 API

Spring 백엔드는 아래 엔드포인트로 추천 후보의 순위를 요청합니다.

```text
POST /internal/v1/recommendations/rank
X-Internal-Api-Key: ${INTERNAL_API_KEY}
```

`INTERNAL_API_KEY`가 비어 있으면 로컬 개발을 위해 인증을 생략합니다. 값이
설정된 환경에서는 같은 값을 헤더로 보내야 합니다.

현재 구현은 예산 적합도와 mood 키워드 일치도를 사용하는 결정적 baseline입니다.
후보의 카테고리, 세부 카테고리, 예산 범위를 다시 검증하고 점수 내림차순으로
최대 `limit`건을 반환합니다. 모델을 연결할 때는
`app/services/recommendation_ranker.py`의 구현을 교체합니다.

## 테스트

```powershell
pytest
```

## 의류 데이터셋 v2 오프라인 재처리

기존 raw bundle과 primary 파일만 사용하며 네트워크 요청을 만들지 않습니다.
원본과 출력 경로는 반드시 분리하고, 출력 경로는 비어 있어야 합니다.

```powershell
python -m garment_collector reprocess `
  --source-root garment_dataset `
  --output-root garment_dataset-v2
```

v2는 상품당 `PRIMARY` 한 장만 보존합니다. `view`, 착용 참고 여부,
모델·다른 의류 포함 여부는 수동 검수 전 미확정 상태로 기록됩니다. raw bundle
해시는 `source.json` 객체를 key 정렬한 compact UTF-8 JSON의 SHA-256입니다.
`garment_dataset*`의 raw·normalized·images·reports 산출물은 Git에 넣지 않습니다.

수동 검수가 끝나 `READY`가 된 균형 선정 항목만 backend seed manifest로
내보낼 수 있습니다. 한 항목이라도 상태·필수 치수·enum·이미지 해시가 맞지
않으면 파일을 생성하지 않습니다.

```powershell
python -m garment_collector export-seed `
  --dataset-root garment_dataset-v2 `
  --selection-file garment_dataset/reports/preload_ready_50each.json `
  --output garment_dataset-v2/reports/gordi-product-seed-v1.json
```

S3 설정과 자격 증명은 `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`AWS_REGION`, `GARMENT_S3_BUCKET`, `GARMENT_IMAGE_BASE_URL` 환경변수로만
받습니다. 먼저 `--dry-run`으로 모든 객체를 검사한 뒤 실행하며, 같은 key의
크기나 SHA-256 metadata가 다르면 덮어쓰지 않고 전체 preflight를 실패시킵니다.

```powershell
python -m garment_collector upload-s3 `
  --manifest garment_dataset-v2/reports/gordi-product-seed-v1.json `
  --dataset-root garment_dataset-v2 `
  --output garment_dataset-v2/reports/gordi-product-seed-v1-uploaded.json `
  --dry-run
```

S3 URL이 추가된 manifest는 `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`,
`MYSQL_USER`, `MYSQL_PASSWORD` 환경변수로 접속한 MySQL에 적재합니다.
`--dry-run`은 schema와 대상 건수만 읽으며, `--apply`는 대상 기존 행을 먼저
백업한 뒤 전체 상품을 한 트랜잭션으로 반영합니다.

```powershell
python -m garment_collector seed-db `
  --manifest garment_dataset-v2/reports/gordi-product-seed-v1-uploaded.json `
  --dry-run
```

EC2 전체 실행 순서와 재실행·정리 기준은
`docs/garment-seed-ec2-runbook.md`를 따릅니다.
