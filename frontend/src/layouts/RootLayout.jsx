import { Outlet } from 'react-router-dom'
import Header from "@/components/Header";

function RootLayout() {
  return (
    <div className="min-h-screen">
      {/* 1. 모든 페이지 상단에 공통으로 띄울 헤더 */}
      <Header />
      
      {/* 2. 라우터 주소에 따라 바뀌는 실제 페이지 내용들 */}
      <main>
        <Outlet />
      </main>
    </div>
  )
}

export default RootLayout