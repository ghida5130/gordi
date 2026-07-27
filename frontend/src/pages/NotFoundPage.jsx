import { Link } from 'react-router-dom'

import PageContainer from '@/components/common/PageContainer'

// 등록되지 않은 주소를 안내하는 대체 화면
function NotFoundPage() {
  return (
    <PageContainer className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="mt-3 text-3xl font-bold">페이지를 찾을 수 없습니다.</h1>
      <p className="mt-4 text-slate-600">
        주소가 올바른지 확인하거나 홈으로 이동해 주세요.
      </p>
      <Link
        to="/"
        className="mt-8 rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-500"
      >
        홈으로 이동
      </Link>
    </PageContainer>
  )
}

export default NotFoundPage
