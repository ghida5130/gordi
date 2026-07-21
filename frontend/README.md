# Gordi Frontend

React, Vite, TypeScript 기반 프론트엔드입니다. `vite.config.ts`가 모노레포 루트의 `.env`를 읽으므로 `VITE_` 접두사가 붙은 값만 브라우저 코드에 공개됩니다.

## 실행

```powershell
pnpm install
pnpm dev
```

기본 주소는 `http://localhost:5173`입니다.

## 명령어

- `pnpm dev`: 개발 서버
- `pnpm build`: 타입 검사 및 운영 빌드
- `pnpm lint`: ESLint 검사
- `pnpm preview`: 운영 빌드 미리보기
