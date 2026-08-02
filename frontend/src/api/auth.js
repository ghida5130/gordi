import { authApi, publicApi } from "@/api/request";

const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ?? "/api"
).replace(/\/+$/, "");

// 인증 전 사용자 정보를 전달하는 로그인 요청
export function login(credentials) {
  return publicApi.post("v1/auth/login", credentials);
}

export function startKakaoLogin() {
  window.location.href = `${apiBaseUrl}/v1/oauth2/authorization/kakao`;
}

// 회원가입 요청 (토큰이 없으므로 publicApi 사용)
export function signup(userData) {
  return publicApi.post("/v1/auth/signup", userData);
}

// 토큰 재발급 요청 (방식에 따라 public 또는 auth를 사용합니다)
export function reissueToken() {
  return publicApi.post(
    "/v1/auth/refresh",
    {},
    {
      withCredentials: true,
    },
  );
}

// 저장된 액세스 토큰을 포함하는 로그아웃 요청
export function logout() {
  return authApi.post("/v1/auth/logout");
}
