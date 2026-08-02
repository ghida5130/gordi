import { authApi, publicApi } from "@/api/request";

export function getProduct(productId) {
  return publicApi.get(`v1/products/${productId}`);
}

export function getAuthenticatedProduct(productId) {
  return authApi.get(`v1/products/${productId}`);
}
