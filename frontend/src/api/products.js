import { publicApi } from "@/api/request";

export function getProduct(productId) {
  return publicApi.get(`v1/products/${productId}`);
}
