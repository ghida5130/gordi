import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/stores/useUserStore';

const MainPage = () => {
  const navigate = useNavigate();
  const { isLogin } = useUserStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="w-full min-h-screen font-sans">
      
      {/* 1. Hero Section */}
      <section className="relative w-full h-screen flex flex-col justify-center items-center text-center bg-gray-200 bg-cover bg-center"
        style={{ backgroundImage: "url('/background-placeholder.jpg')" }} // 실제 배경 이미지 경로로 수정 필요
      >
        <div className="absolute inset-0 bg-black/20"></div>

        <div className="relative z-10 flex flex-col items-center mt-20">
          <h1 className="text-5xl md:text-6xl font-bold text-black mb-6 leading-tight">
            나만의 아바타로<br />친구들과 함께<br />골라봐요
          </h1>
          <p className="text-gray-800 text-lg mb-10 font-medium">
            체형 데이터를 기반으로 생성된 내 아바타에 AI 추천 옷을 입혀보고,<br />
            친구들과 함께 티어를 매겨 최고의 코디를 완성하세요.
          </p>
          <button 
            onClick={() => {
              if (!isLogin) {
                navigate('/login');
              } else {
                setIsModalOpen(true);
              }
            }}
            className="bg-[#1a1a1a] text-white px-8 py-4 rounded-full text-lg font-medium hover:bg-black transition-colors flex items-center gap-2"
          >
            지금 시작하기 <span>→</span>
          </button>
        </div>
      </section>

      {/* 2. Features Section */}
      <section className="w-full py-24 px-10 bg-white flex flex-col items-center">
        <div className="max-w-6xl w-full">
          <h2 className="text-3xl font-bold mb-2">패션 선택을<br />더 즐겁게</h2>
          <p className="text-gray-500 mb-12">혼자 고르기 어려웠던 옷 선택, 이제 AI와 친구들과 함께 해결하세요.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gray-50 p-8 rounded-2xl">
              <div className="mb-4 text-2xl">👤</div>
              <h3 className="font-bold text-lg mb-3">내 체형 맞춤 아바타</h3>
              <p className="text-sm text-gray-600">키, 체중, 어깨 너비 등 간단한 체형 정보를 입력하면 나를 꼭 닮은 아바타가 만들어져요.</p>
            </div>
            <div className="bg-gray-50 p-8 rounded-2xl">
              <div className="mb-4 text-2xl">✨</div>
              <h3 className="font-bold text-lg mb-3">AI가 골라주는 옷</h3>
              <p className="text-sm text-gray-600">내 체형과 스타일 취향을 AI가 분석해 딱 맞는 옷 리스트를 큐레이션해줘요.</p>
            </div>
            <div className="bg-gray-50 p-8 rounded-2xl">
              <div className="mb-4 text-2xl">👥</div>
              <h3 className="font-bold text-lg mb-3">친구들과 티어 매기기</h3>
              <p className="text-sm text-gray-600">친구를 초대해 AI 추천 옷들을 함께 S/A/B/C 티어로 평가해보세요.</p>
            </div>
            <div className="bg-gray-50 p-8 rounded-2xl">
              <div className="mb-4 text-2xl">👕</div>
              <h3 className="font-bold text-lg mb-3">아바타에 직접 입혀보기</h3>
              <p className="text-sm text-gray-600">티어를 정한 옷을 내 아바타에 실제로 입혀보며 전체 코디를 완성해보세요.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Steps Section */}
      <section className="w-full py-24 px-10 bg-[#141414] text-white flex flex-col items-center">
        <div className="max-w-6xl w-full">
          <div className="text-center mb-16">
            <p className="text-sm text-gray-400 mb-2">사용 방법</p>
            <h2 className="text-3xl font-bold">단 4단계로<br />시작해요</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="border-t border-gray-700 pt-6">
              <h3 className="text-4xl font-light text-blue-500 mb-4">01</h3>
              <span className="text-xs border border-gray-600 rounded-full px-3 py-1 mb-4 inline-block">체형 분석 알고리즘</span>
              <h4 className="font-bold text-lg mb-2">체형 정보 입력</h4>
              <p className="text-sm text-gray-400">키, 체중, 어깨 너비 등 간단한 체형 정보를 입력하세요. 3분이면 충분해요.</p>
            </div>
            <div className="border-t border-gray-700 pt-6">
              <h3 className="text-4xl font-light text-blue-500 mb-4">02</h3>
              <span className="text-xs border border-gray-600 rounded-full px-3 py-1 mb-4 inline-block">실시간 렌더링</span>
              <h4 className="font-bold text-lg mb-2">아바타 생성</h4>
              <p className="text-sm text-gray-400">입력된 정보를 기반으로 나를 닮은 아바타가 자동으로 만들어져요.</p>
            </div>
            <div className="border-t border-gray-700 pt-6">
              <h3 className="text-4xl font-light text-blue-500 mb-4">03</h3>
              <span className="text-xs border border-gray-600 rounded-full px-3 py-1 mb-4 inline-block">매일 업데이트</span>
              <h4 className="font-bold text-lg mb-2">AI 옷 추천</h4>
              <p className="text-sm text-gray-400">AI가 내 체형과 트렌드를 분석해 딱 맞는 옷 리스트를 큐레이션해줘요.</p>
            </div>
            <div className="border-t border-gray-700 pt-6">
              <h3 className="text-4xl font-light text-blue-500 mb-4">04</h3>
              <span className="text-xs border border-gray-600 rounded-full px-3 py-1 mb-4 inline-block">실시간 협업</span>
              <h4 className="font-bold text-lg mb-2">친구와 코디 완성</h4>
              <p className="text-sm text-gray-400">친구를 초대해 함께 티어를 정하고 아바타에 입혀보며 최종 코디를 완성하세요.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/40 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="relative bg-white rounded-3xl p-10 w-full max-w-sm flex flex-col items-center text-center shadow-2xl z-10">
            <div className="w-12 h-12 bg-black text-white rounded-xl flex justify-center items-center mb-6">
              💼
            </div>
            <h3 className="text-2xl font-bold mb-2">티어메이킹 시작하기</h3>
            <p className="text-gray-500 text-sm mb-8">
              친구들과 함께 의상을 골라보세요.<br />투표로 최고의 아이템을 확정하세요.
            </p>
            
            <button 
              onClick={() => {
                setIsModalOpen(false);
                navigate('/rooms/create');
              }}
              className="w-full bg-[#1a1a1a] text-white py-4 rounded-xl font-medium mb-3 hover:bg-black transition-colors"
            >
              새 방 만들기 →
            </button>
            <button 
              onClick={() => {
                setIsModalOpen(false);
                navigate('/rooms');
              }}
              className="w-full bg-gray-100 text-gray-800 py-4 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              초대 코드로 입장
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default MainPage;