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

## 테스트

```powershell
pytest
```
