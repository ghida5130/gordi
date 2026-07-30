# 고르디(Gordi)

## 프로젝트 폴더 구조
```
S15P11D105/
├── docs/
│   ├── 01_중간평가1/        # 평가1
│   ├── 02_중간평가2/        # 평가2
│   ├── 03_중간평가3/        # 평가3
│   ├── 04_최종평가/         # 마지막 평가
│   │
│   ├── images/              # 마크다운 문서들에 삽입할 공통 이미지들 (UI 캡처, 아키텍처 사진 등)
│   └── README.md            # docs 폴더 전체 목차 및 안내
│
├── frontend/                
├── backend/                 
└── README.md                
```

## 로컬 Docker 실행 방법

> Docker 빌드에는 시간이 다소 걸릴 수 있습니다.  
> 개발 중에는 로컬 서버를 사용하고, 최종 확인이 필요할 때 Docker 환경을 실행하는 것을 권장합니다.

### 1. 데이터베이스 실행

프로젝트 루트에서 다음 명령어를 실행합니다.

```bash
docker compose up -d
```

기본 `docker-compose.yml`을 사용해 데이터베이스 컨테이너를 실행합니다.

### 2. 프론트엔드 및 백엔드 실행

개별 컨테이너 따로 실행하기 

```bash
docker compose -f docker-compose.local.yml up -d --build frontend
docker compose -f docker-compose.local.yml up -d --build backend
docker compose -f docker-compose.local.yml up -d --build ai
```

여러 개를 한 번에도 가능
```bash
docker compose -f docker-compose.local.yml up -d --build backend ai
```

백엔드, 프론트, ai 한번에 컨테이너 실행 

```bash
docker compose -f docker-compose.local.yml up -d --build
```

### 3. 접속 주소

| 서비스 | URL |
| --- | --- |
| 프론트엔드 | http://localhost/ |
| 백엔드 API | http://localhost/api/ |
| AI API | http://localhost/ai/ |
| Swagger UI | http://localhost/api/swagger-ui/index.html |

### 주의사항

- Docker 이미지 빌드에는 시간이 다소 걸릴 수 있습니다.
- 평소에는 로컬 서버에서 개발하고, 필요한 경우 Docker 환경에서 최종 확인하는 것을 권장합니다.
- 로컬 서버와 Docker 컨테이너를 동시에 실행하면 포트 충돌이 발생할 수 있으므로 둘 중 하나만 실행해 주세요.


