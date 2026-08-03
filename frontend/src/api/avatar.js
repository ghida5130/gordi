import { authApi } from '@/api/request'

// 신체 정보에 맞는 아바타 템플릿 목록 조회
export function getAvatarTemplates({ gender, heightId, weightId }) {
  return authApi.post('/v1/avatars/templates', { gender, heightId, weightId })
}
