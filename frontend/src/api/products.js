import { authApi, publicApi } from "@/api/request";

function roomTokenConfig(roomToken, config = {}) {
  return {
    ...config,
    headers: {
      ...config.headers,
      Authorization: `Bearer ${roomToken}`,
    },
  };
}

export function searchProducts({ roomToken, params }) {
  return publicApi.get("v1/products", roomTokenConfig(roomToken, { params }));
}

export function getProduct({ roomToken, productId }) {
  return publicApi.get(
    `v1/products/${encodeURIComponent(productId)}`,
    roomTokenConfig(roomToken),
  );
}

export function getAuthenticatedProduct(productOrOptions) {
  const productId =
    typeof productOrOptions === "object"
      ? productOrOptions.productId
      : productOrOptions;
  return authApi.get(`v1/products/${encodeURIComponent(productId)}`);
}
