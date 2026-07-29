import axios from "axios";

import { AuthRequiredError } from "@/api/errors";
import { useUserStore } from "@/stores/useUserStore";
import { getAccessToken, removeAccessToken } from "@/utils/tokenStorage";

const apiBaseUrl = "https://i15d105.p.ssafy.io/api";

const clientConfig = {
  baseURL: apiBaseUrl,
  timeout: 10_000,
};

// 인증 정보 없이 사용하는 공개 요청용 클라이언트
export const httpClient = axios.create({
  ...clientConfig,
});

// 액세스 토큰이 반드시 필요한 인증 요청용 클라이언트
export const authHttpClient = axios.create({
  ...clientConfig,
});

authHttpClient.interceptors.request.use((config) => {
  // 토큰이 없으면 서버 요청 전에 인증 오류 반환
  const accessToken = getAccessToken();

  if (!accessToken) {
    return Promise.reject(new AuthRequiredError());
  }

  config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

authHttpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 만료되거나 유효하지 않은 토큰의 반복 사용 방지
    if (error.response?.status === 401) {
      removeAccessToken();
      useUserStore.getState().clearUser();
    }

    return Promise.reject(error);
  },
);
