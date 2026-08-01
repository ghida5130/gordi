import axios from "axios";

import { AuthRequiredError } from "@/api/errors";
import { useUserStore } from "@/stores/useUserStore";
import {
  getAccessToken,
  setAccessToken, // ⭐️ 새 토큰 저장을 위해 추가
  removeAccessToken,
} from "@/utils/tokenStorage";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost/api";

const clientConfig = {
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10_000,
}

// 인증 정보 없이 사용하는 공개 요청용 클라이언트
export const httpClient = axios.create({
  ...clientConfig,
})

// 액세스 토큰이 반드시 필요한 인증 요청용 클라이언트
export const authHttpClient = axios.create({
  ...clientConfig,
})

authHttpClient.interceptors.request.use((config) => {
  // 토큰이 없으면 서버 요청 전에 인증 오류 반환
  const accessToken = getAccessToken()

  if (!accessToken) {
    return Promise.reject(new AuthRequiredError())
  }

  config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

// ⭐️ 토큰 만료 시 자동 재발급 로직 추가
authHttpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // 에러가 난 원래의 요청 정보
    const originalRequest = error.config;

    // 401 에러(인증 실패)이고, 아직 재시도를 안 한 요청이라면
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // 꼬리표를 달아서 무한 루프 방지

      try {
        // 1. 순환 참조를 막기 위해 httpClient를 직접 사용하여 재발급 요청
        // 💡 쿠키에 담긴 Refresh Token을 보내려면 withCredentials: true가 반드시 필요합니다!
        const refreshResponse = await httpClient.post(
          "/v1/auth/refresh",
          {},
          {
            withCredentials: true,
          },
        );

        // 2. 응답에서 새 Access Token 추출 (명세서의 response.data.data 구조 반영)
        const newAccessToken =
          refreshResponse.data?.data?.accessToken ||
          refreshResponse.data?.accessToken;

        if (newAccessToken) {
          // 3. 스토리지에 새 토큰 덮어쓰기
          setAccessToken(newAccessToken);

          // 4. 실패했던 원래 요청 헤더에 새 토큰을 끼워 넣기
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

          // 5. 실패했던 원래 요청을 새 토큰으로 다시 보내기 (사용자는 에러 났는지 모름!)
          return authHttpClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh Token마저 만료되었거나 오류가 났을 경우 (완전 로그아웃 처리)
        console.error("Refresh Token 만료. 다시 로그인해주세요.");
        removeAccessToken();
        useUserStore.getState().clearUser();

        // 로그인 페이지로 강제 이동
        window.location.href = "/login";

        return Promise.reject(refreshError);
      }
    }

    // 401 에러가 아니거나, 재시도 로직에 해당하지 않는 에러는 그대로 반환
    return Promise.reject(error);
  },
);