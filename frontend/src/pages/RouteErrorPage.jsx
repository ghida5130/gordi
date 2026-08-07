import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'

import StatePage from '@/components/common/StatePage'

// 라우트 렌더링 중 발생한 예외를 사용자용 메시지로 변환
function RouteErrorPage() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? error.statusText
    : '화면을 불러오는 중 문제가 발생했습니다.'

  return (
    <StatePage
      title="화면을 불러오지 못했습니다"
      description={message}
      tone="danger"
      icon="!"
    >
      <Link
        to="/"
        className="group rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-red-600"
      >
        메인으로 이동 <span className="ml-1 inline-block transition-transform group-hover:translate-x-1">→</span>
      </Link>
    </StatePage>
  )
}

export default RouteErrorPage
