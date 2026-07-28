import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { signup } from '@/api/auth';

export default function SignupPage() {
  const navigate = useNavigate();

  // 폼 상태 관리
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');

  // 약관 동의 상태 관리
  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false,
    marketing: false,
  });

  // 정규식 (유효성 검사)
  const passwordRegex = /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[!@#$%^&*?_]).{8,}$/;
  const nicknameRegex = /^[a-zA-Z가-힣0-9]{2,12}$/; // 특수문자 제외 2~12자

  // React-Query 회원가입 요청
  const { mutate, isPending } = useMutation({
    mutationFn: signup,
    onSuccess: () => {
      alert('회원가입이 완료되었습니다! 로그인해주세요.');
      navigate('/login'); // 가입 성공 시 로그인 페이지로 이동
    },
    onError: (error) => {
      console.error('회원가입 실패:', error);
      alert('회원가입에 실패했습니다. 다시 시도해주세요.');
    }
  });

  // 전체 동의 핸들러
  const handleAllCheck = (e) => {
    const isChecked = e.target.checked;
    setAgreements({
      terms: isChecked,
      privacy: isChecked,
      marketing: isChecked,
    });
  };

  // 개별 동의 핸들러
  const handleSingleCheck = (e) => {
    const { name, checked } = e.target;
    setAgreements((prev) => ({ ...prev, [name]: checked }));
  };

  // 폼 제출 핸들러
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!passwordRegex.test(password)) {
      alert('비밀번호는 영문, 숫자, 특수문자 포함 8자리 이상이어야 합니다.');
      return;
    }
    if (password !== passwordConfirm) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (!nicknameRegex.test(nickname)) {
      alert('닉네임은 특수문자를 제외한 2~12글자로 입력해주세요.');
      return;
    }
    if (!agreements.terms || !agreements.privacy) {
      alert('필수 이용약관에 동의해주세요.');
      return;
    }

    // 백엔드로 보낼 데이터
    mutate({
      email,
      password,
      nickname,
      marketing_agreed: agreements.marketing,
    });
  };

  const isAllChecked = agreements.terms && agreements.privacy && agreements.marketing;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 py-10">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-sm border border-gray-100">
        
        {/* 상단 탭 (회원가입 활성화) */}
        <div className="flex p-1 bg-gray-50 rounded-full border border-gray-200">
          <Link to="/login" className="w-1/2 py-2 text-sm font-medium text-center text-gray-500 rounded-full hover:bg-gray-100 transition">로그인</Link>
          <div className="w-1/2 py-2 text-sm font-bold text-center text-white bg-black rounded-full shadow">회원가입</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4 p-4 border border-gray-100 rounded-lg bg-white">
            <h3 className="text-xs font-bold text-gray-400">계정 정보</h3>
            
            {/* 이메일 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black transition"
              />
              <p className="text-[10px] text-gray-400 mt-1">로그인에 사용됩니다</p>
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black transition"
              />
              <p className="text-[10px] text-gray-400 mt-1">영문+숫자+특수문자 8자리 이상</p>
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">비밀번호 확인</label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black transition"
              />
            </div>

            {/* 닉네임 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">닉네임</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="앱에서 사용되는 이름"
                required
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black transition"
              />
              <p className="text-[10px] text-gray-400 mt-1">2~12글자, 특수문자 제외</p>
            </div>
          </div>

          {/* 약관 동의 */}
          <div className="p-4 border border-gray-100 rounded-lg bg-white space-y-3">
            <h3 className="text-xs font-bold text-gray-400 mb-2">약관 동의</h3>
            
            <label className="flex items-center space-x-2 pb-2 border-b border-gray-100 cursor-pointer">
              <input type="checkbox" checked={isAllChecked} onChange={handleAllCheck} className="rounded text-black focus:ring-black" />
              <span className="text-sm font-medium">전체 동의</span>
            </label>
            
            <div className="space-y-2 pt-1">
              <label className="flex items-center justify-between text-xs cursor-pointer">
                <div className="flex items-center space-x-2">
                  <input type="checkbox" name="terms" checked={agreements.terms} onChange={handleSingleCheck} className="rounded text-black focus:ring-black" />
                  <span className="text-gray-600">[필수] 이용약관</span>
                </div>
                <button type="button" className="text-blue-500 hover:underline">보기</button>
              </label>
              
              <label className="flex items-center justify-between text-xs cursor-pointer">
                <div className="flex items-center space-x-2">
                  <input type="checkbox" name="privacy" checked={agreements.privacy} onChange={handleSingleCheck} className="rounded text-black focus:ring-black" />
                  <span className="text-gray-600">[필수] 개인정보 처리방침</span>
                </div>
                <button type="button" className="text-blue-500 hover:underline">보기</button>
              </label>
              
              <label className="flex items-center justify-between text-xs cursor-pointer">
                <div className="flex items-center space-x-2">
                  <input type="checkbox" name="marketing" checked={agreements.marketing} onChange={handleSingleCheck} className="rounded text-black focus:ring-black" />
                  <span className="text-gray-600">[선택] 마케팅 정보 수신 동의</span>
                </div>
                <button type="button" className="text-blue-500 hover:underline">보기</button>
              </label>
            </div>
          </div>

          {/* 가입 버튼 */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 mt-4 text-sm font-bold text-white bg-black rounded-lg hover:bg-gray-800 disabled:bg-gray-300 transition"
          >
            {isPending ? '처리 중...' : '회원가입 완료'}
          </button>
        </form>

        <div className="text-sm text-center text-gray-500 pt-4">
          이미 계정이 있으신가요? <Link to="/login" className="text-blue-500 hover:underline ml-1">로그인</Link>
        </div>
      </div>
    </div>
  );
}