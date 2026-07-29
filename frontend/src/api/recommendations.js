import { authApi } from '@/api/request'

// 카테고리·세부 분류·무드·예산 정책·추천 개수 조회 (화면에서 하드코딩하지 않고 이 값을 사용)
export function getRecommendationOptions() {
  return authApi.get('/recommendation-options')
}

// 조건 기반 추천 스냅샷 생성 (idempotencyKey 로 중복 생성 방지)
export function createRecommendation(condition, idempotencyKey) {
  return authApi.post('/recommendations', condition, {
    headers: { 'Idempotency-Key': idempotencyKey },
  })
}

// 저장된 추천 스냅샷 조회
export function getRecommendation(recommendationId) {
  return authApi.get(`/recommendations/${recommendationId}`)
}

// 선택 상품 교체 후 추천 새 버전 생성 (baseVersion 이 다르면 409 VERSION_CONFLICT)
export function replaceRecommendationItems(
  recommendationId,
  { baseVersion, productIds },
  idempotencyKey,
) {
  return authApi.post(
    `/recommendations/${recommendationId}/replacements`,
    { baseVersion, productIds },
    { headers: { 'Idempotency-Key': idempotencyKey } },
  )
}
