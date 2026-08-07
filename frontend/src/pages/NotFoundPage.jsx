import { Link } from 'react-router-dom'

import StatePage from '@/components/common/StatePage'

// 등록되지 않은 주소를 안내하는 대체 화면
function NotFoundPage() {
  return (
    <StatePage
      title="페이지를 찾을 수 없습니다"
      description="입력한 주소를 다시 확인하거나 메인페이지에서 원하는 메뉴를 찾아보세요."
      icon="?"
      withinLayout
    >
      <Link
        to="/"
        className="group rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-violet-600"
      >
        메인으로 이동 <span className="ml-1 inline-block transition-transform group-hover:translate-x-1">→</span>
      </Link>
    </StatePage>
  )
}

export default NotFoundPage
