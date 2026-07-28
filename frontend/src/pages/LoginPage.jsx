import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
// 작성하신 auth.js 파일에서 login 함수를 가져옵니다.
import { login } from '@/api/auth'; 
import { Link } from 'react-router-dom';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // React-Query를 이용한 로그인 API 호출
  const { mutate, isPending } = useMutation({
    mutationFn: login, // auth.js에서 만든 그 함수입니다.
    onSuccess: (response) => {
      // 나중에 이 부분에 utils/tokenStorage.js를 이용해 토큰을 저장하는 코드를 넣게 됩니다.
      console.log('로그인 성공:', response.data);
      alert('로그인에 성공했습니다!');
    },
    onError: (error) => {
      console.error('로그인 실패:', error);
      alert('이메일 또는 비밀번호를 확인해주세요.');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault(); // 폼 제출 시 새로고침 방지
    if (!email || !password) {
      alert('이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }
    // 백엔드로 보낼 데이터(credentials) 형태
    mutate({ email, password }); 
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-sm border border-gray-100">
        
        {/* 상단 탭 */}
        <div className="flex p-1 bg-gray-50 rounded-full border border-gray-200">
        <button className="w-1/2 py-2 text-sm font-bold text-white bg-black rounded-full shadow">로그인</button>
        
        {/* 👇 button을 Link로 바꾸고 to="/signup"을 추가했습니다. (가운데 정렬을 위해 text-center도 추가) */}
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
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-500">비밀번호</label>
              <button type="button" className="text-xs text-blue-500 hover:underline">비밀번호 찾기</button>
            </div>
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