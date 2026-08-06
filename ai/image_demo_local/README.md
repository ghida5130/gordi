# Gordi Image Model Evaluation Demo - Local

Cloudflare Tunnel 없이 한 PC에서만 실행하는 이미지 생성 모델 블라인드 평가 데모다. 서버는 기본적으로 `127.0.0.1`에만 바인딩되므로 같은 PC의 브라우저에서만 접근할 수 있다.

기존 `ai/image_demo`와 실행 데이터는 건드리지 않는다. 이 디렉터리는 독립된 로컬 전용 사본이며, 새 평가 결과는 `backend/demo_data`에 저장된다.

## 빠른 실행 (Windows PowerShell)

처음 한 번은 Python·Node 의존성을 설치한다.

```powershell
cd ai\image_demo_local
.\start-local.ps1 -Install
```

다음 실행부터는 설치 옵션 없이 시작한다.

```powershell
.\start-local.ps1
```

- 데모 UI: `http://127.0.0.1:5174`
- 2차 테스트 입력: `http://127.0.0.1:5174/?round=2`
- 데모 API: `http://127.0.0.1:8100`
- Swagger UI: `http://127.0.0.1:8100/docs`

종료할 때는 실행한 터미널에서 `Ctrl+C`를 누른다. 스크립트가 프런트엔드와 백엔드를 함께 종료한다.

## 환경 설정

첫 실행 시 `.env.example`이 `.env`로 복사된다. 실제 이미지 생성이 필요하면 생성된 `.env`의 `OPENROUTER_API_KEY`를 채운다. 키 없이도 화면에서 목업 모드를 켜면 전체 평가 흐름을 확인할 수 있다.

포트를 바꾸려면 아래 값을 함께 수정한다.

```dotenv
IMAGE_DEMO_API_PORT=8100
IMAGE_DEMO_FRONTEND_PORT=5174
VITE_IMAGE_DEMO_API_BASE_URL=http://127.0.0.1:8100
```

## 수동 실행

백엔드:

```powershell
cd ai\image_demo_local\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe run.py
```

새 터미널에서 프런트엔드:

```powershell
cd ai\image_demo_local\frontend
npm ci
npm run dev
```

이 로컬 버전에는 Cloudflare 설정, 외부 호스트 허용 목록, Tunnel 전용 빌드 모드가 포함되지 않는다.
