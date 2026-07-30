// src/components/Header.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Header() {
  const navigate = useNavigate();
  const [hoveredMenu, setHoveredMenu] = useState(null);

  // 🌟 [핵심 기능] 로컬 스토리지에 accessToken이 있는지 확인해서 로그인 상태 판별
  const isLoggedIn = !!localStorage.getItem('accessToken');

  // 로그아웃 처리 함수
  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    alert('로그아웃 되었습니다.');
    navigate('/login');
  };

  // Jitter 스타일 메가 드롭다운 내용 정의 (무채색 톤 적용)
  const dropdownContent = {
    tier: (
      <div className="flex gap-4">
        <Link to="/rooms/create" className="block w-64 p-6 bg-black hover:bg-gray-800 hover:-translate-y-2 transition-all duration-300 rounded-xl text-white shadow-sm hover:shadow-lg">
          <h3 className="text-xl font-bold mb-2">방 생성하기</h3>
          <p className="text-sm text-gray-300 font-light">새로운 티어 게임 방을 만들어<br/>친구들을 초대해보세요 &rarr;</p>
        </Link>
        <div className="block w-64 p-6 bg-gray-50 border border-gray-200 rounded-xl text-gray-400 cursor-not-allowed">
          <h3 className="text-xl font-bold mb-2">참여하기</h3>
          <p className="text-sm text-gray-400 font-light">진행 중인 티어 게임에<br/>참여하는 기능입니다. (준비 중) &rarr;</p>
        </div>
      </div>
    ),
    clothes: (
      <div className="flex gap-4">
        <Link to="/recommend-clothes" className="block w-64 p-6 bg-black hover:bg-gray-800 hover:-translate-y-2 transition-all duration-300 rounded-xl text-white shadow-sm hover:shadow-lg">
          <h3 className="text-xl font-bold mb-2">오늘의 의상 추천</h3>
          <p className="text-sm text-gray-300 font-light">날씨와 기분에 맞는 완벽한<br/>코디를 추천받아보세요 &rarr;</p>
        </Link>
      </div>
    ),
  };

  return (
    <>
      {/* 부드럽게 내려오는 슬라이드 다운 애니메이션 CSS */}
      <style>
        {`
          @keyframes slideDown {
            0% { opacity: 0; transform: translateY(-10px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          .animate-slide-down {
            animation: slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}
      </style>

      <div className="relative border-b border-gray-100 bg-white z-50">
        <header className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          
          <Link 
            to="/" 
            className="flex items-center gap-2 transition-transform duration-300 hover:-translate-y-1 hover:scale-105 active:scale-95" 
            onMouseEnter={() => setHoveredMenu(null)}
          >
            <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M12 10a3 3 0 1 0-3-3" />
              <path d="M12 10L2.5 16.5A1.5 1.5 0 0 0 3.5 19h17a1.5 1.5 0 0 0 1-2.5L12 10z" />
            </svg>
            <span className="text-xl font-bold tracking-tight text-black">gordi</span>
          </Link>

          <nav className="flex items-center gap-8 h-full">
            <div 
              className="h-full flex items-center"
              onMouseEnter={() => setHoveredMenu('tier')}
            >
              <Link 
                to="/rooms/create" 
                className="font-semibold text-gray-900 transition-all duration-300 hover:-translate-y-1 hover:text-black"
              >
                티어메이커
              </Link>
            </div>

            <div 
              className="h-full flex items-center"
              onMouseEnter={() => setHoveredMenu('clothes')}
            >
              <Link 
                to="/recommend-clothes" 
                className="font-semibold text-gray-500 transition-all duration-300 hover:-translate-y-1 hover:text-black"
              >
                의상 추천
              </Link>
            </div>
          </nav>

          {/* 우측 프로필 및 로그인/로그아웃 */}
          <div className="flex items-center gap-5" onMouseEnter={() => setHoveredMenu(null)}>
            
            {/* 🌟 isLoggedIn 상태에 따른 버튼 조건부 렌더링 */}
            {isLoggedIn ? (
              <>
                <button 
                  onClick={handleLogout} 
                  className="text-sm text-gray-500 transition-all duration-300 hover:-translate-y-1 hover:text-black"
                >
                  로그아웃
                </button>
                <Link 
                  to="/profile/edit" 
                  className="w-9 h-9 flex items-center justify-center border-2 border-gray-200 text-gray-500 rounded-full transition-all duration-300 hover:-translate-y-1 hover:border-black hover:text-black hover:shadow-sm active:scale-95"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </Link>
              </>
            ) : (
              <Link 
                to="/login" 
                className="text-sm font-semibold text-black transition-all duration-300 hover:-translate-y-1 hover:text-gray-600"
              >
                로그인
              </Link>
            )}

          </div>
        </header>

        {hoveredMenu && (
          <div 
            className="absolute top-16 left-0 w-full bg-white border-b border-gray-100 shadow-lg shadow-gray-100/50 animate-slide-down"
            onMouseLeave={() => setHoveredMenu(null)}
          >
            <div className="max-w-6xl mx-auto px-6 py-8 flex justify-center">
              {dropdownContent[hoveredMenu]}
            </div>
          </div>
        )}
      </div>
    </>
  );
}