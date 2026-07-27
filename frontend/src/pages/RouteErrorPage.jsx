import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'

import PageContainer from '@/components/common/PageContainer'

// 라우트 렌더링 중 발생한 예외를 사용자용 메시지로 변환
function RouteErrorPage() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? error.statusText
    : '화면을 불러오는 중 문제가 발생했습니다.'

  return (
    <PageContainer className="flex min-h-screen flex-col items-center justify-center text-center">
      <p className="text-sm font-semibold text-red-600">오류 발생</p>
      <h1 className="mt-3 text-3xl font-bold">{message}</h1>
      <Link
        to="/"
        className="mt-8 rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-500"
      >
        홈으로 이동
      </Link>
    </PageContainer>
  )
}

export default RouteErrorPage
