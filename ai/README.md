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

## OpenRouter 기반 Gemini Embedding 2 카탈로그 임베딩

추천 검색용 카탈로그는 MySQL의 `AVAILABLE` 상품 정보와 primary 이미지 한 장을
OpenRouter의 `google/gemini-embedding-2` 같은 요청에 넣어 768차원 결합
임베딩으로 만듭니다. 호출 엔드포인트는 기본적으로
`https://openrouter.ai/api/v1/embeddings`입니다.
가격과 판매 상태는 검색 필터 메타데이터로 보존하되 임베딩 입력에서는 제외해,
가격 변경만으로 유료 재임베딩하지 않습니다.

로컬에서 S3 이미지 URL을 아직 제공하지 않을 때는 `--dataset-root`로 검수된
이미지를 읽을 수 있습니다. DB 상품 정보는 두 실행 모두 동일하게 사용합니다.

```powershell
python -m app.recommendation.embedding_cli `
  --dataset-root garment_dataset-v2 `
  --output catalog_index/catalog-embeddings.json `
  --limit 1
```

`OPENROUTER_API_KEY`, `OPENROUTER_EMBEDDING_MODEL`,
`OPENROUTER_EMBEDDING_DIMENSIONS`와 MySQL 환경변수가 필요합니다. 선택적으로
`OPENROUTER_HTTP_REFERER`, `OPENROUTER_APP_TITLE`을 설정할 수 있습니다.
성공한 상품은
별도 checkpoint에 원자적으로 기록되므로 중단 후 같은 명령을 실행하면 입력
해시가 동일한 임베딩을 재사용합니다. 전체 성공 시에만 `COMPLETE` snapshot을
교체하며 `catalog_index/` 산출물은 Git에서 제외합니다.

직접 Gemini API로 만든 기존 snapshot은 OpenRouter 모델 식별자와 일치하지
않으므로 위 명령으로 다시 생성해야 합니다. 애플리케이션은 모델이 다른
snapshot을 검색에 사용하지 않습니다.

생성된 snapshot은 애플리케이션에서 `CatalogVectorIndex.load()`로 검증 후
메모리에 적재합니다. 현재 198건 MVP는 외부 벡터 DB 없이 정확한 cosine
검색을 사용하며, 성별(동일 성별 또는 `UNISEX`)·카테고리·세부 카테고리·가격
조건을 점수 계산 전에 적용합니다. 기본 검색 후보는 50건, 최대 200건입니다.
Compose 배포에서는 Git에서 제외된 인덱스 디렉터리를 `/app/catalog_index`에
읽기 전용으로 마운트합니다. EC2에서는
`CATALOG_EMBEDDING_INDEX_HOST_DIR`에 Jenkins workspace 밖의 고정 디렉터리를
지정하고 그 안에 `catalog-embeddings.json`을 별도로 배치해야 합니다. Git
push만으로 이 파일이 전송되지는 않습니다.

후보 50건은 `RecommendationPipeline`에서 상품명·설명·세부 카테고리로
확인되는 색상·계절·스타일 태그와 규칙 기반 궁합 점수를 적용해 상위 10건으로
재정렬합니다. 전용 DB 컬럼이 없는 세 조건은 누락값 때문에 상품을 제거하지
않는 soft score이며, 추천 이유에는 실제로 일치한 태그와 예산 조건만
사용합니다. `CompatibilityModel`과 `RecommendationReasonGenerator`
인터페이스를 구현하면 이후 학습 모델이나 VLM으로 교체할 수 있습니다.

백엔드가 AI 검색까지 위임할 때는 기존 후보 기반 `/rank` 대신 아래 내부 API를
호출합니다. `text`와 `imageUrl` 중 하나 이상이 필요하며 이미지 URL은
`RECOMMENDATION_IMAGE_ALLOWED_HOSTS`에 등록된 호스트만 허용됩니다.

```text
POST /internal/v1/recommendations/search
X-Internal-Api-Key: ${INTERNAL_API_KEY}
```

요청에는 `recommendationId`, `gender`, 선택 `category`/`subcategory`,
`budgetMin`/`budgetMax`, `candidateLimit`(기본 50), `resultLimit`(기본 10)을
보냅니다. 응답은 `productId`, 최종·검색·궁합 점수, 추천 이유와 사용한
embedding snapshot SHA-256을 반환합니다.

## FastAPI 단독 추천 데모

로컬에서만 `ENABLE_RECOMMENDATION_DEMO=true`로 설정한 뒤 AI 서버를 실행하면
`http://localhost:8000/demo/recommendations`에서 이미지 업로드부터 후보 검색,
조건·궁합 재정렬, 추천 이유까지 한 화면에서 확인할 수 있습니다. 운영 기본값은
`false`이며 비활성 상태에서는 페이지와 업로드 API 모두 404를 반환합니다.
Docker Compose로 실행할 때도 루트 `.env`의 플래그가 AI 컨테이너에
명시적으로 전달됩니다.

DB의 이미지 URL이 브라우저에서 접근할 수 없는 Docker 내부 주소라면, 검수
데이터셋 경로를 아래처럼 지정해 FastAPI가 primary 이미지만 로컬 데모에
제공하도록 할 수 있습니다. 이 경로는 Git에 포함하지 않습니다.

```text
RECOMMENDATION_DEMO_DATASET_ROOT=garment_dataset-v2
```

데모 API는 `POST /api/v1/demo/recommendations` multipart 요청이며 JPEG/PNG
최대 10MB, 텍스트 2,000자를 허용합니다. 실제 실행 전
`catalog_index/catalog-embeddings.json` 생성과 `OPENROUTER_API_KEY` 설정이
필요합니다.
