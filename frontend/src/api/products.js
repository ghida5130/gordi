import { publicApi, withRoomToken } from "@/api/request";

export function searchProducts({ roomToken, params }) {
  return publicApi.get("v1/products", withRoomToken(roomToken, { params }));
}

export function getProduct({ roomToken, productId }) {
  return publicApi.get(
    `v1/products/${encodeURIComponent(productId)}`,
    withRoomToken(roomToken),
  );
}
