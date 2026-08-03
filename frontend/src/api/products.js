import { authApi, publicApi } from "@/api/request";

import { publicApi } from "@/api/request";

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

export function addCandidate({ roomToken, roomId, productId }) {
  return publicApi.post(
    "v1/candidates",
    { roomId, productId },
    roomTokenConfig(roomToken),
  );
}

export function deleteCandidate({ roomToken, roomId, productId }) {
  return publicApi.delete(
    `v1/candidates/${encodeURIComponent(productId)}`,
    roomTokenConfig(roomToken, { params: { roomId } }),
  );
}

export function getCandidates({ roomToken, roomId }) {
  return publicApi.get(
    "v1/candidates",
    roomTokenConfig(roomToken, { params: { roomId } }),
  );
}
