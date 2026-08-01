import { authApi } from "@/api/request";

export function createTryOnJob(tryOnInformation, idempotencyKey) {
  return authApi.post("v1/try-on-jobs", tryOnInformation, {
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
  });
}
