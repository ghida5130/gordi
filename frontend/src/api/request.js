import { authHttpClient, httpClient } from "@/lib/httpClient";

function createRestClient(client) {
  return {
    get: async (url, config = {}) => {
      const response = await client.get(url, config);
      return response.data;
    },

    post: async (url, data, config = {}) => {
      const response = await client.post(url, data, config);
      return response.data;
    },

    put: async (url, data, config = {}) => {
      const response = await client.put(url, data, config);
      return response.data;
    },

    patch: async (url, data, config = {}) => {
      const response = await client.patch(url, data, config);
      return response.data;
    },

    delete: async (url, config = {}) => {
      const response = await client.delete(url, config);
      return response.data;
    },
  };
}

// 공개 API 요청에 사용 (accessToken 미포함)
export const publicApi = createRestClient(httpClient);

// 인증 API 요청에 사용 (accessToken 포함)
export const authApi = createRestClient(authHttpClient);
