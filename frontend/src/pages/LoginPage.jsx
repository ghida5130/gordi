import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { login } from '@/api/auth'; 
import { Link } from 'react-router-dom';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: login,
    onSuccess: (response) => {
      console.log('로그인 성공:', response.data);
      alert('로그인에 성공했습니다!');
    },
    onError: (error) => {
      console.error('로그인 실패:', error);
      alert('이메일 또는 비밀번호를 확인해주세요.');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert('이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }
    mutate({ email, password }); 
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-sm border border-gray-100">
        
        {/* 상단 탭 */}
        <div className="flex p-1 bg-gray-50 rounded-full border border-gray-200">
          <button className="w-1/2 py-2 text-sm font-bold text-white bg-black rounded-full shadow">로그인</button>
          
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
            {/* 👇 비밀번호 찾기 버튼이 있던 자리를 말끔하게 정리했습니다. */}
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