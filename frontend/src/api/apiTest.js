import { authHttpClient, httpClient } from "@/lib/httpClient";

export async function sendApiTestRequest({
  method,
  url,
  includeAccessToken,
  accessToken,
  body,
}) {
  const client = includeAccessToken ? authHttpClient : httpClient;
  const response = await client.request({
    method,
    url,
    data: body,
    headers:
      includeAccessToken && accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : undefined,
  });

  return {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers.toJSON(),
    data: response.data,
  };
}
