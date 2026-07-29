const ACCESS_TOKEN_KEY = "at";

// 저장된 액세스 토큰 조회
export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

// 로그인 성공 후 액세스 토큰 저장
export function setAccessToken(accessToken) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

// 로그아웃 또는 인증 만료 시 액세스 토큰 제거
export function removeAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}
