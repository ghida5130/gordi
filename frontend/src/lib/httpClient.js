import axios from "axios";

import { AuthRequiredError } from "@/api/errors";
import { clearSession } from "@/utils/clearSession";
import { getAccessToken, setAccessToken } from "@/utils/tokenStorage";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

const clientConfig = {
  baseURL: apiBaseUrl,
  timeout: 30_000,
};

let refreshPromise = null;

// - 인증 정보 없이 사용하는 공개 요청 클라이언트
export const httpClient = axios.create({
  ...clientConfig,
});

// - 액세스 토큰이 필요한 인증 요청 클라이언트
export const authHttpClient = axios.create({
  ...clientConfig,
});

function getRefreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = httpClient
      .post(
        "/v1/auth/refresh",
        {},
        {
          withCredentials: true,
        },
      )
      .then((response) => {
        const accessToken =
          response.data?.data?.accessToken ?? response.data?.accessToken;

        if (!accessToken) {
          const error = new Error("Access token is missing in refresh response.");
          error.code = "INVALID_REFRESH_RESPONSE";
          throw error;
        }

        setAccessToken(accessToken);
        return accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function isExpiredRefreshSession(error) {
  return (
    error.code === "INVALID_REFRESH_RESPONSE" ||
    error.response?.status === 401 ||
    error.response?.status === 403
  );
}

authHttpClient.interceptors.request.use((config) => {
  const accessToken = getAccessToken();

  if (!accessToken) {
    return Promise.reject(new AuthRequiredError());
  }

  config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// - 만료된 액세스 토큰을 한 번만 재발급하고 대기 중인 요청 재실행
authHttpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const accessToken = await getRefreshAccessToken();

      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return authHttpClient(originalRequest);
    } catch (refreshError) {
      if (isExpiredRefreshSession(refreshError)) {
        clearSession();
        window.location.replace("/login");
      }

      return Promise.reject(refreshError);
    }
  },
);
