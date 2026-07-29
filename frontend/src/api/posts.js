import { publicApi } from '@/api/request'

// 인증 없이 게시글 목록 조회
export function getPosts(params = {}) {
  return publicApi.get('posts', { params })
}
