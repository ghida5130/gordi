import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { login } from '@/api/auth'; 
import { Link, useNavigate } from 'react-router-dom';
// 💡 토큰 저장 함수 불러오기
import { setAccessToken } from '@/utils/tokenStorage';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // ⭐️ 최신 로그인 API 명세서 반영
  const { mutate, isPending } = useMutation({
    mutationFn: login,
    onSuccess: (response) => {
      // 1. 응답 데이터에서 Access Token 추출
      const accessToken = response.data?.data?.accessToken || response.data?.accessToken;
      
      // 2. 토큰을 스토리지에 저장
      if (accessToken) {
        setAccessToken(accessToken);
      }
      
      alert('로그인에 성공했습니다!');
      
      // 3. 메인(홈) 화면으로 이동
      navigate('/');
    },
    onError: (error) => {
      // 4. 상태 코드별 맞춤 에러 메시지 띄우기
      const status = error.response?.status;
      
      if (status === 401) {
        alert('이메일 또는 비밀번호가 일치하지 않습니다.');
      } else if (status === 400) {
        alert('입력하신 정보의 형식이 올바르지 않습니다.');
      } else {
        console.error('로그인 실패:', error);
        alert('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert('이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }
    
    // 백엔드 명세서에 맞게 email, password 전송
    mutate({ email, password }); 
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-sm border border-gray-100">
        
        {/* 상단 탭 */}
        <div className="flex p-1 bg-gray-50 rounded-full border border-gray-200">
          <div className="w-1/2 py-2 text-sm font-bold text-center text-white bg-black rounded-full shadow">
            로그인
          </div>
          <Link to="/signup" className="w-1/2 py-2 text-sm font-medium text-center text-gray-500 rounded-full hover:bg-gray-100 transition">
            회원가입
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 mt-4 text-sm font-bold text-white bg-black rounded-lg hover:bg-gray-800 disabled:bg-gray-300 transition"
          >
            {isPending ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="text-sm text-center text-gray-500 pt-4">
          계정이 없으신가요? <Link to="/signup" className="text-blue-500 hover:underline ml-1">회원가입</Link>
        </div>
      </div>
    </div>
  );
}