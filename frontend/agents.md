# 0. 프로젝트 환경

- React 19
- JavaScript
- TanStack/React-Query
- Axios
- Tailwind
- Zustand

# 1. 기본 원칙

- 동일한 역할의 Axios 인스턴스, API 함수, Query Client, 전역 스토어 중복 생성 금지
- 불필요한 추상화, 과도한 예외처리 금지
- 빌드 테스트는 수행하지 말 것
- 라우터에 직접 연결되는 화면 컴포넌트는 pages 아래에 작성
- 필요한 API 함수는 src/api 내에 만들어야하며 여기있는것을 import해서 사용
- 로딩, 에러, 스켈레톤 처리는 필요하다면 추가할것
- 공통 및 역할 분리 컴포넌트는 src/components 내에 작성
- 프론트엔드와 백엔드가 같은 EC2 내부에서 배포되므로 라우팅에 참고할것. 상대경로를 사용할것.

# 2. 주석

- 기능 변경으로 인해 주석 내용이 달라져야 하는 경우가 아니면 기존 주석을 수정하거나 제거 금지
- 새 주석은 한글 개조식으로 간단하게 작성하며 불필요한 주석 금지
- 주석에 파일명이나 폴더명을 설명하지 말 것

# 3. 공통사용 폴더 및 파일 구조

- src/routes/router.jsx : 라우팅 관리
- src/api : api 요청 관련 함수 모음 폴더
- src/api/request.js : accessToken 유무로 나뉘는 공개, 비공개 요청용 공통 REST 함수, publicApi는 accessToken이 필요없는 요청에 사용하며 authApi는 accessToken이 필요한 요청에 사용
- src/api/errors.js : 비공개 요청시 accessToken이 없는경우 발생되는 커스텀 에러
- src/lib/httpClient.js : 공통 Axios 기본 설정, 토큰 처리
- src/lib/queryClient.js : TanStack Query 전역 기본 설정
- src/utils/apiError.js : 요청에 대한 accessToken, axios, 응답에러 등을 반환
- src/utils/tokenStorage.js : 로컬스토리지에 있는 액세스토큰을 관리하는 함수 모음
- HTTP 요청 메서드, API 주소 및 요청 데이터, Tanstack Query 전역 설정, accessToken 관련 설정, axios 사용, 기본 에러처리는 공통 관리되고 있으며 tanstack query의 구체적 사용은 각 컴포넌트가 직접 사용
