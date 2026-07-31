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
