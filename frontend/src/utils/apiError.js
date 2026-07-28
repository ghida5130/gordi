import axios from 'axios'

import { isAuthRequiredError } from '@/api/errors'

// 서버 메시지를 우선 사용하고 없으면 안전한 기본 문구를 반환
export function getApiErrorMessage(
  error,
  fallbackMessage = '요청 처리 중 문제가 발생했습니다.',
) {
  if (isAuthRequiredError(error)) {
    return error.message
  }

  if (!axios.isAxiosError(error)) {
    return fallbackMessage
  }

  if (error.response?.status === 401) {
    return (
      error.response.data?.message ??
      '로그인이 만료되었습니다. 다시 로그인해 주세요.'
    )
  }

  return error.response?.data?.message ?? error.message ?? fallbackMessage
}
