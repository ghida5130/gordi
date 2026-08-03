import { authApi } from "@/api/request";

export function getRecommendationOptions() {
  return authApi.get("v1/recommendation-options");
}

export function createRecommendation({ recommendation, idempotencyKey }) {
  return authApi.post("v1/recommendations", recommendation, {
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
  });
}

export function getRecommendation(recommendationId) {
  return authApi.get(`v1/recommendations/${encodeURIComponent(recommendationId)}`);
}

export function replaceRecommendationItems({
  recommendationId,
  baseVersion,
  productIds,
  idempotencyKey,
}) {
  return authApi.post(
    `v1/recommendations/${encodeURIComponent(recommendationId)}/replacements`,
    { baseVersion, productIds },
    {
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}
