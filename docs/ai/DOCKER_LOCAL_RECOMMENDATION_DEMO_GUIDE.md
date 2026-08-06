# 로컬 Docker 의상 추천 데모 실행 가이드

이 문서는 Gordi 의상 추천 데모를 로컬 Windows PowerShell에서 처음부터 실행할 때
사용한 Docker 명령을 한곳에 정리한 가이드다.

다음 작업을 순서대로 다룬다.

1. Docker와 환경 파일 준비
2. 공용 Docker network 및 인프라 실행
3. MySQL 사용자와 상품 데이터 확인
4. AI 이미지 빌드
5. OpenRouter로 카탈로그 임베딩 생성
6. FastAPI 추천 데모 실행
7. 상태·로그 확인과 종료
8. 자주 발생한 오류 해결

> **실행 위치**
>
> 별도 설명이 없는 명령은 저장소 루트
> `C:\Users\SSAFY\Documents\S15P11D105`에서 실행한다.

## 0. Docker 명령에서 자주 보는 옵션

| 옵션 | 의미 |
|---|---|
| `docker compose` | 여러 컨테이너를 Compose YAML 정의대로 관리 |
| `docker build -t 이름 경로` | Dockerfile로 이미지를 만들고 이름(tag)을 지정 |
| `docker run` | 이미지로 새 컨테이너를 만들어 실행 |
| `--rm` | 컨테이너 종료 시 해당 컨테이너를 자동 삭제 |
| `-d` | 터미널을 점유하지 않고 백그라운드로 실행 |
| `-it` | 터미널에서 직접 입력할 수 있도록 실행 |
| `--name` | 생성할 컨테이너 이름 지정 |
| `--network` | 컨테이너를 지정한 Docker network에 연결 |
| `--env-file` | 환경변수 파일을 컨테이너에 주입 |
| `-e KEY=value` | 환경변수 하나를 직접 주입 |
| `-p 8000:8000` | 호스트 8000 포트를 컨테이너 8000 포트에 연결 |
| `--mount` / `-v` | 호스트 파일·디렉터리를 컨테이너 안에 연결 |
| `:ro` / `readonly` | 마운트한 파일을 컨테이너에서 읽기 전용으로 사용 |
| `--no-cache` | 이전 빌드 결과를 재사용하지 않고 이미지를 다시 빌드 |

PowerShell에서 여러 줄 명령을 쓸 때는 줄 끝의 백틱 `` ` `` 뒤에 공백을 넣으면
안 된다. 복사 후 명령이 이상하게 나뉘면 한 줄로 붙여서 실행해도 된다.

## 1. 사전 확인

Docker Desktop을 실행한 뒤 버전을 확인한다.

```powershell
docker version
docker compose version
```

현재 Docker 상태를 확인한다.

```powershell
docker ps
docker ps -a
```

- `docker ps`: 현재 실행 중인 컨테이너
- `docker ps -a`: 종료된 컨테이너까지 포함

저장소 루트로 이동한다.

```powershell
Set-Location C:\Users\SSAFY\Documents\S15P11D105
```

## 2. 기본 `.env` 준비

루트 `.env`가 없다면 예시 파일을 복사한다.

```powershell
Copy-Item .env.example .env
```

`.env`의 `change_me` 값을 실제 로컬 값으로 교체한다. 최소한 MySQL, Redis,
RabbitMQ, JWT 관련 값이 필요하다.

`.env`는 자격 증명을 포함하므로 Git에 추가하지 않는다.

```powershell
git status --short
```

## 3. 공용 Docker network 준비

이 저장소의 Compose 파일은 `app-network`를 외부 network로 사용한다. 최초 한
번만 생성하면 된다.

```powershell
docker network inspect app-network *> $null

if ($LASTEXITCODE -ne 0) {
  docker network create app-network
}
```

생성 여부를 확인한다.

```powershell
docker network ls
```

## 4. MySQL·Redis·RabbitMQ 실행

루트의 `docker-compose.yml`은 인프라 컨테이너를 실행한다.

```powershell
docker compose up -d
```

상태를 확인한다.

```powershell
docker compose ps
docker ps
```

기본 컨테이너 이름은 다음과 같다.

| 서비스 | 컨테이너 이름 | 호스트 포트 |
|---|---|---:|
| MySQL | `gordi-mysql` | 3306 |
| Redis | `gordi-redis` | 6379 |
| RabbitMQ | `gordi-rabbitmq` | 5672, 15672 |

MySQL이 `healthy`가 될 때까지 로그를 확인한다.

```powershell
docker logs --tail 100 gordi-mysql
```

실시간으로 계속 보려면 `-f`를 사용한다. 종료는 `Ctrl+C`다.

```powershell
docker logs -f --tail 100 gordi-mysql
```

## 5. MySQL 사용자 생성

MySQL 볼륨이 이미 만들어진 뒤 `.env`의 `MYSQL_USER`를 변경했다면, 환경변수를
바꾸는 것만으로 사용자가 새로 생기지 않는다. 기존 볼륨에서는 사용자를 직접
만들어야 한다.

### 5.1 root로 MySQL 접속

다음 명령은 root 비밀번호를 화면에 출력하지 않고 MySQL 셸을 연다.

```powershell
docker exec -it `
  -e MYSQL_HISTFILE=/dev/null `
  gordi-mysql `
  sh -lc 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot'
```

### 5.2 DB와 사용자 생성

열린 MySQL 프롬프트에서 실행한다. `<새 비밀번호>`는 루트 `.env`의
`MYSQL_PASSWORD`와 동일하게 설정한다.

```sql
CREATE DATABASE IF NOT EXISTS gordi
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'gordi'@'%'
  IDENTIFIED BY '<새 비밀번호>';

ALTER USER 'gordi'@'%'
  IDENTIFIED BY '<새 비밀번호>';

GRANT ALL PRIVILEGES ON gordi.* TO 'gordi'@'%';

SHOW GRANTS FOR 'gordi'@'%';
```

`gordi.*`는 `gordi` DB 내부 권한만 의미한다. 모든 DB에 대한 `*.*` 전역 권한은
부여하지 않는다.

MySQL 셸을 닫는다.

```sql
exit
```

## 6. 백엔드·프론트엔드·AI·Nginx 실행

로컬 애플리케이션 Compose를 빌드하고 실행한다.

```powershell
docker compose -f docker-compose.local.yml up -d --build
```

상태를 확인한다.

```powershell
docker compose -f docker-compose.local.yml ps
```

주요 로그를 확인한다.

```powershell
docker logs --tail 100 gordi-backend
docker logs --tail 100 gordi-ai
docker logs --tail 100 gordi-nginx
```

특정 서비스만 새로 만들고 싶다면 다음처럼 실행한다.

```powershell
docker compose -f docker-compose.local.yml up -d --build ai
```

환경변수나 Compose 설정을 바꾼 뒤 컨테이너를 확실히 다시 만들려면 다음 명령을
사용한다.

```powershell
docker compose -f docker-compose.local.yml up -d --force-recreate ai
```

## 7. MySQL 상품 데이터 확인

임베딩 생성 전 `MUSINSA`의 `AVAILABLE` 상품이 198건인지 확인한다.

```powershell
docker exec gordi-mysql sh -lc 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u"$MYSQL_USER" "$MYSQL_DATABASE" -Nse "SELECT COUNT(*) FROM products WHERE source=\"MUSINSA\" AND availability=\"AVAILABLE\";"'
```

예상 출력:

```text
198
```

DB 접속 오류가 발생하면 MySQL 컨테이너 안의 사용자 설정을 확인한다.

```powershell
docker exec gordi-mysql sh -lc 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u"$MYSQL_USER" "$MYSQL_DATABASE" -Nse "SELECT CURRENT_USER(), DATABASE();"'
```

## 8. 임베딩 전용 환경 파일 준비

루트 `.env` 전체를 일회성 도구 컨테이너에 전달하지 않고, 필요한 값만 별도
파일에 저장한다.

파일 경로:

```text
C:\tmp\gordi-ai-embedding.env
```

내용:

```env
OPENROUTER_API_KEY=<실제 OpenRouter 키>
OPENROUTER_EMBEDDING_MODEL=google/gemini-embedding-2
OPENROUTER_EMBEDDING_DIMENSIONS=768
OPENROUTER_EMBEDDING_ENDPOINT=https://openrouter.ai/api/v1/embeddings
OPENROUTER_PROVIDER_ORDER=google-vertex
OPENROUTER_ALLOW_FALLBACKS=false

MYSQL_HOST=gordi-mysql
MYSQL_PORT=3306
MYSQL_DATABASE=gordi
MYSQL_USER=gordi
MYSQL_PASSWORD=<로컬 DB 비밀번호>
```

중요한 점:

- Docker 컨테이너 안에서 `localhost`는 해당 컨테이너 자신을 뜻한다.
- MySQL은 같은 network의 컨테이너 이름인 `gordi-mysql`로 접근해야 한다.
- 현재 Google AI Studio provider에서 upstream 인증 오류가 발생했으므로
  `google-vertex`만 허용하고 fallback을 끈다.
- env 값에 불필요한 따옴표나 앞뒤 공백을 넣지 않는다.

## 9. AI 이미지 빌드

추천 코드가 포함된 AI 이미지를 별도 tag로 빌드한다.

```powershell
docker build -t gordi-ai-local:vertex .\ai
```

이전 코드가 계속 실행되는 것으로 의심되면 캐시 없이 새로 빌드한다.

```powershell
docker build `
  --no-cache `
  --progress=plain `
  -t gordi-ai-local:vertex `
  .\ai
```

생성한 이미지를 확인한다.

```powershell
docker image ls gordi-ai-local
```

이미지 내부에 Vertex 우선 코드가 포함됐는지 확인한다.

```powershell
docker run --rm `
  gordi-ai-local:vertex `
  python -c "from app.recommendation.catalog_embeddings import DEFAULT_OPENROUTER_PROVIDER_ORDER; print(DEFAULT_OPENROUTER_PROVIDER_ORDER)"
```

예상 출력:

```text
('google-vertex',)
```

환경 파일이 컨테이너에서 제대로 읽히는지도 키를 출력하지 않고 확인할 수 있다.

```powershell
docker run --rm `
  --env-file C:\tmp\gordi-ai-embedding.env `
  gordi-ai-local:vertex `
  python -c "from app.recommendation.catalog_embeddings import EmbeddingSettings; s=EmbeddingSettings.from_env(); print(s.provider_order, s.allow_fallbacks)"
```

예상 출력:

```text
('google-vertex',) False
```

## 10. 카탈로그 임베딩 생성

### 10.1 호스트 경로 준비

```powershell
New-Item -ItemType Directory -Force .\ai\catalog_index | Out-Null

$datasetPath = (Resolve-Path .\ai\garment_dataset-v2).Path
$indexPath = (Resolve-Path .\ai\catalog_index).Path
```

PowerShell 세션을 새로 열면 `$datasetPath`, `$indexPath` 변수도 사라지므로 위
명령을 다시 실행해야 한다.

### 10.2 상품 1건 pilot

먼저 한 건만 실행해 OpenRouter, MySQL, 이미지 mount가 모두 정상인지 확인한다.

```powershell
docker run --rm `
  --network app-network `
  --env-file C:\tmp\gordi-ai-embedding.env `
  --mount "type=bind,source=$datasetPath,target=/data,readonly" `
  --mount "type=bind,source=$indexPath,target=/output" `
  gordi-ai-local:vertex `
  python -m app.recommendation.embedding_cli `
  --dataset-root /data `
  --output /output/catalog-embeddings.json `
  --limit 1
```

정상 출력 예시:

```json
{
  "product_count": 1,
  "embedded_count": 1,
  "reused_count": 0,
  "output_path": "/output/catalog-embeddings.json",
  "snapshot_sha256": "..."
}
```

### 10.3 전체 198건 생성

pilot 명령에서 `--limit 1`만 제거한다.

```powershell
docker run --rm `
  --network app-network `
  --env-file C:\tmp\gordi-ai-embedding.env `
  --mount "type=bind,source=$datasetPath,target=/data,readonly" `
  --mount "type=bind,source=$indexPath,target=/output" `
  gordi-ai-local:vertex `
  python -m app.recommendation.embedding_cli `
  --dataset-root /data `
  --output /output/catalog-embeddings.json
```

pilot 한 건을 재사용했다면 예상 결과는 다음과 같다.

```json
{
  "product_count": 198,
  "embedded_count": 197,
  "reused_count": 1
}
```

429, 일시적인 네트워크 오류 등으로 중단되면 같은 명령을 다시 실행한다.
checkpoint에 저장된 성공 항목은 입력 해시가 같을 때 재사용된다.

### 10.4 snapshot 확인

```powershell
$snapshot = Get-Content .\ai\catalog_index\catalog-embeddings.json -Raw |
  ConvertFrom-Json

$snapshot |
  Select-Object status, model, dimensions, product_count, snapshot_sha256
```

예상값:

| 필드 | 값 |
|---|---|
| `status` | `COMPLETE` |
| `model` | `google/gemini-embedding-2` |
| `dimensions` | `768` |
| `product_count` | `198` |

`ai/catalog_index`는 생성 산출물이므로 Git에 커밋하지 않는다.

## 11. FastAPI 추천 데모 컨테이너 실행

`gordi-ai-local:vertex`는 앞 단계의 임베딩 생성 명령에서 직접 사용한 이미지다.
아래 데모는 Compose의 `ai` 서비스 이미지를 사용하므로, 추천 코드를 변경한
뒤에는 Compose 이미지도 별도로 다시 빌드해야 한다.

```powershell
docker compose `
  --env-file C:\tmp\gordi-ai-embedding.env `
  -f docker-compose.local.yml `
  build --no-cache ai
```

기존 `gordi-ai-demo` 컨테이너가 있으면 먼저 제거한다.

```powershell
docker rm -f gordi-ai-demo
```

Compose의 AI 서비스를 이용해 데모 전용 컨테이너를 실행한다.

```powershell
docker compose `
  --env-file C:\tmp\gordi-ai-embedding.env `
  -f docker-compose.local.yml `
  run --rm `
  --name gordi-ai-demo `
  -p 8000:8000 `
  -e API_PREFIX=/api/v1 `
  -e ENABLE_RECOMMENDATION_DEMO=true `
  -e OPENROUTER_PROVIDER_ORDER=google-vertex `
  -e OPENROUTER_ALLOW_FALLBACKS=false `
  -e RECOMMENDATION_DEMO_DATASET_ROOT=/app/garment_dataset-v2 `
  -v "./ai/garment_dataset-v2:/app/garment_dataset-v2:ro" `
  ai
```

이 명령은 터미널을 점유하며 FastAPI 로그를 바로 보여준다. 종료는 `Ctrl+C`다.
`--rm`이 있으므로 정상 종료 후 데모 컨테이너는 자동 삭제된다.

브라우저 주소:

- Health: `http://localhost:8000/api/v1/health`
- 추천 데모: `http://localhost:8000/demo/recommendations`

데모에서 검색 버튼을 누를 때마다 사용자 입력 임베딩을 위한 OpenRouter 요청이
발생한다.

### 백그라운드로 실행하고 싶을 때

`run` 명령에 `-d`를 추가한다.

```powershell
docker compose `
  --env-file C:\tmp\gordi-ai-embedding.env `
  -f docker-compose.local.yml `
  run -d --rm `
  --name gordi-ai-demo `
  -p 8000:8000 `
  -e API_PREFIX=/api/v1 `
  -e ENABLE_RECOMMENDATION_DEMO=true `
  -e OPENROUTER_PROVIDER_ORDER=google-vertex `
  -e OPENROUTER_ALLOW_FALLBACKS=false `
  -e RECOMMENDATION_DEMO_DATASET_ROOT=/app/garment_dataset-v2 `
  -v "./ai/garment_dataset-v2:/app/garment_dataset-v2:ro" `
  ai
```

로그 확인:

```powershell
docker logs -f --tail 100 gordi-ai-demo
```

종료:

```powershell
docker stop gordi-ai-demo
```

## 12. 컨테이너 안에서 설정 확인

실행 중인 데모가 예상한 provider 설정을 받았는지 확인한다.

```powershell
docker exec gordi-ai-demo python -c "from app.core.config import get_settings; s=get_settings(); print(s.openrouter_provider_order, s.openrouter_allow_fallbacks)"
```

예상 출력:

```text
google-vertex False
```

인덱스 파일이 mount됐는지 확인한다.

```powershell
docker exec gordi-ai-demo sh -lc 'ls -lh /app/catalog_index/catalog-embeddings.json'
```

데이터셋이 mount됐는지 확인한다.

```powershell
docker exec gordi-ai-demo sh -lc 'find /app/garment_dataset-v2 -type f | head'
```

## 13. 상태와 로그를 확인하는 기본 명령

전체 실행 컨테이너:

```powershell
docker ps
```

종료 컨테이너까지 포함:

```powershell
docker ps -a
```

Compose 서비스 상태:

```powershell
docker compose ps
docker compose -f docker-compose.local.yml ps
```

최근 로그 100줄:

```powershell
docker logs --tail 100 gordi-ai-demo
```

실시간 로그:

```powershell
docker logs -f gordi-ai-demo
```

컨테이너 상세 정보:

```powershell
docker inspect gordi-ai-demo
```

컨테이너가 연결된 network 확인:

```powershell
docker inspect gordi-ai-demo --format '{{json .NetworkSettings.Networks}}'
```

## 14. 종료와 재시작

데모 컨테이너만 종료:

```powershell
docker stop gordi-ai-demo
```

로컬 앱 전체 중지 및 컨테이너 제거:

```powershell
docker compose -f docker-compose.local.yml down
```

인프라 전체 중지 및 컨테이너 제거:

```powershell
docker compose down
```

위 `down` 명령만으로 MySQL 데이터 volume은 삭제되지 않는다. 다시 실행하면
기존 DB 데이터가 유지된다.

인프라를 다시 실행:

```powershell
docker compose up -d
```

앱을 다시 실행:

```powershell
docker compose -f docker-compose.local.yml up -d
```

> **주의: DB 데이터 삭제**
>
> `docker compose down -v`는 MySQL·Redis·RabbitMQ volume까지 삭제한다.
> 로컬 상품 198건을 포함한 DB 데이터가 사라질 수 있으므로 초기화를 정말
> 원하는 경우가 아니면 `-v`를 붙이지 않는다.

## 15. 임시 자격 증명 파일 정리

테스트가 끝나고 더 이상 필요 없다면 저장소 밖의 임시 env 파일을 삭제한다.

```powershell
Remove-Item -LiteralPath C:\tmp\gordi-ai-embedding.env
```

계속 데모를 사용할 예정이면 파일을 유지할 수 있지만, 다른 사용자에게 전달하거나
Git에 추가하면 안 된다.

## 16. 자주 발생한 오류

### `network app-network declared as external, but could not be found`

원인: 외부 Docker network가 아직 없다.

```powershell
docker network create app-network
```

### `Access denied for user 'gordi'`

가능한 원인:

- MySQL volume 생성 후 `.env` 사용자 또는 비밀번호만 변경
- 컨테이너 안에서 `MYSQL_HOST=localhost` 사용
- 별도 embedding env의 비밀번호가 루트 `.env`와 다름

해결:

1. 이 문서의 **MySQL 사용자 생성** 절차를 다시 실행한다.
2. 컨테이너에서는 `MYSQL_HOST=gordi-mysql`을 사용한다.
3. 애플리케이션 컨테이너를 재생성한다.

### `API key not valid`와 `domain: googleapis.com`

OpenRouter 키 파일이 틀린 것이 아니라 Google AI Studio provider의 upstream
인증 오류일 수 있다. 이번 로컬 환경에서는 Vertex만 사용해 해결했다.

env에 다음 값이 있어야 한다.

```env
OPENROUTER_PROVIDER_ORDER=google-vertex
OPENROUTER_ALLOW_FALLBACKS=false
```

데모 실행 명령에도 같은 값을 `-e`로 전달한다. 이미지가 이전 코드일 가능성이
있으면 새 tag로 `--no-cache` 빌드한다.

### 이미지를 다시 빌드했는데 예전 코드가 실행됨

실행 명령의 이미지 tag와 빌드한 tag가 같은지 확인한다.

```powershell
docker image ls
docker inspect gordi-ai-demo --format '{{.Config.Image}}'
```

확실하게 다시 빌드:

```powershell
docker build --no-cache -t gordi-ai-local:vertex .\ai
```

Compose 서비스 이미지를 빌드했다면 독립 `docker run`에서도 Compose 이미지가
아닌 다른 tag를 사용하고 있지 않은지 확인한다.

### `port is already allocated`

호스트 8000 포트를 이미 다른 컨테이너가 사용 중이다.

```powershell
docker ps --filter "publish=8000"
```

기존 컨테이너를 중지하거나 다른 호스트 포트를 쓴다.

```powershell
docker stop gordi-ai
```

다른 포트 예시:

```text
-p 8001:8000
```

이 경우 데모 주소는 `http://localhost:8001/demo/recommendations`다.

### mount 경로 오류

경로 변수가 실제 값인지 확인한다.

```powershell
$datasetPath
$indexPath
Test-Path $datasetPath
Test-Path $indexPath
```

PowerShell을 다시 열었다면 변수 선언을 다시 실행한다.

### 인덱스가 없거나 `COMPLETE`가 아님

```powershell
Test-Path .\ai\catalog_index\catalog-embeddings.json

Get-Content .\ai\catalog_index\catalog-embeddings.json -Raw |
  ConvertFrom-Json |
  Select-Object status, model, dimensions, product_count
```

`status=COMPLETE`, `product_count=198`인지 확인한다.

## 17. 부록: Docker로 로컬 상품 DB 다시 적재

현재 로컬 DB에 상품 198건이 있다면 이 절차는 다시 실행할 필요가 없다. DB를
새로 만든 경우에만 사용한다.

상품 적재는 일반 AI 이미지가 아닌 의류 관리 도구 전용 Dockerfile을 사용한다.

```powershell
docker build `
  -f .\ai\Dockerfile.garment-tools `
  -t gordi-garment-tools:local `
  .\ai
```

로컬 DB 검증용 manifest와 백업을 연결할 호스트 경로를 준비한다.

```powershell
$reportsPath = (Resolve-Path .\ai\garment_dataset-v2\reports).Path
```

먼저 DML을 실행하지 않는 dry-run으로 schema와 manifest를 검사한다.

```powershell
docker run --rm `
  --network app-network `
  --env-file C:\tmp\gordi-ai-embedding.env `
  --mount "type=bind,source=$reportsPath,target=/work" `
  gordi-garment-tools:local `
  seed-db `
  --manifest /work/gordi-product-seed-v1-local-db.json `
  --dry-run
```

출력의 상품 수가 198, 사이즈 행이 732인지 확인한 뒤 실제 적재한다.

```powershell
docker run --rm `
  --network app-network `
  --env-file C:\tmp\gordi-ai-embedding.env `
  --mount "type=bind,source=$reportsPath,target=/work" `
  gordi-garment-tools:local `
  seed-db `
  --manifest /work/gordi-product-seed-v1-local-db.json `
  --apply `
  --backup-output /work/local-db-pre-apply-backup-manual.json
```

이 도구는 `(source, external_id)` 기준으로 upsert하고 하나의 트랜잭션으로
처리한다. 중간 검증이 실패하면 전체 rollback한다. 기존 대상 데이터는 지정한
백업 JSON에 저장된다.

같은 명령을 다시 실행할 때는 기존 백업을 덮어쓰지 않도록 다른
`--backup-output` 파일명을 사용한다.

적재 후 상품 수를 다시 확인한다.

```powershell
docker exec gordi-mysql sh -lc 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u"$MYSQL_USER" "$MYSQL_DATABASE" -Nse "SELECT COUNT(*) FROM products WHERE source=\"MUSINSA\" AND availability=\"AVAILABLE\";"'
```

S3 업로드와 EC2 운영 적재는 별도 문서
[`garment-seed-ec2-runbook.md`](./garment-seed-ec2-runbook.md)를 따른다.

## 18. 가장 짧은 재실행 순서

이미 MySQL 상품 198건과 임베딩 snapshot이 준비된 이후에는 다음만 실행하면
된다.

```powershell
Set-Location C:\Users\SSAFY\Documents\S15P11D105

docker compose up -d

docker compose `
  --env-file C:\tmp\gordi-ai-embedding.env `
  -f docker-compose.local.yml `
  run --rm `
  --name gordi-ai-demo `
  -p 8000:8000 `
  -e API_PREFIX=/api/v1 `
  -e ENABLE_RECOMMENDATION_DEMO=true `
  -e OPENROUTER_PROVIDER_ORDER=google-vertex `
  -e OPENROUTER_ALLOW_FALLBACKS=false `
  -e RECOMMENDATION_DEMO_DATASET_ROOT=/app/garment_dataset-v2 `
  -v "./ai/garment_dataset-v2:/app/garment_dataset-v2:ro" `
  ai
```

브라우저에서 `http://localhost:8000/demo/recommendations`를 연다.
