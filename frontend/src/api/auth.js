import { authApi, publicApi } from '@/api/request'

// 인증 전 사용자 정보를 전달하는 로그인 요청
export function login(credentials) {
  return publicApi.post('v1/auth/login', credentials)
}

export function signup(userInformation) {
  return publicApi.post('v1/auth/signup', userInformation)
}

// 저장된 액세스 토큰을 포함하는 로그아웃 요청
export function logout() {
  return authApi.post('v1/auth/logout')
}
