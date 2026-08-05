import { Outlet, useLocation } from 'react-router-dom'
import Header from "@/components/Header";
import Toast from "@/components/Toast";

function RootLayout() {
  const { pathname } = useLocation();
  const isMainPage = pathname === "/";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 1. 모든 페이지 상단에 공통으로 띄울 헤더 */}
      <Header />
      <Toast />
      
      {/* 2. 라우터 주소에 따라 바뀌는 실제 페이지 내용들 */}
      <main className={isMainPage ? "" : "pt-24"}>
        <Outlet />
      </main>
    </div>
  )
}

export default RootLayout
