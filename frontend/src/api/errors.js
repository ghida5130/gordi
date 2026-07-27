// 인증 요청 전 토큰 누락을 네트워크·서버 오류와 구분하기 위한 전용 오류
// 인증 클라이언트에서 요청을 중단하고 화면에 로그인 필요 상태 전달
export class AuthRequiredError extends Error {
  constructor(message = '로그인이 필요한 서비스입니다.') {
    super(message)
    this.name = 'AuthRequiredError'
    this.code = 'AUTH_TOKEN_MISSING'
  }
}

// 오류 객체 변환 이후에도 고유 코드를 기준으로 인증 오류 판별
// 로그인 화면 이동이나 사용자 안내가 필요한 위치에서 사용
export function isAuthRequiredError(error) {
  return (
    error instanceof AuthRequiredError ||
    error?.code === 'AUTH_TOKEN_MISSING'
  )
}
