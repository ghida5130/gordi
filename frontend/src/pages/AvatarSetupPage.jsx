import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getAvatarTemplates } from '@/api/avatar';

// 키(cm) -> 키 ID 매핑
function mapHeightToId(height) {
  const h = Number(height);
  if (h < 150) return 1;
  if (h < 160) return 2;
  if (h < 170) return 3;
  if (h < 180) return 4;
  return 5;
}

// 몸무게(kg) -> 몸무게 ID 매핑
function mapWeightToId(weight) {
  const w = Number(weight);
  if (w < 50) return 1;
  if (w < 60) return 2;
  if (w < 70) return 3;
  if (w < 80) return 4;
  return 5;
}

const BODY_TYPE_LABELS = {
  SLIM: '상체형',
  STANDARD: '밸런스',
  MUSCULAR: '하체형',
};

export default function AvatarSetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // 1단계 입력 폼 상태
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('170');
  const [weight, setWeight] = useState('65');

  // API 응답으로 받아온 아바타 리스트
  const [avatars, setAvatars] = useState([]);
  
  // 2단계 선택된 아바타 상태
  const [selectedAvatar, setSelectedAvatar] = useState(null);

  // 1단계: 신체 정보 제출 및 API 호출
  const { mutate: fetchTemplates, isPending } = useMutation({
    mutationFn: getAvatarTemplates,
    onSuccess: (response) => {
      // CommonResponse 구조 반영 (res.data.avatars or res.avatars)
      const avatarList = response.data?.avatars || response.avatars || [];
      setAvatars(avatarList);
      
      // 기본 선택 아바타는 STANDARD(밸런스) 혹은 목록의 첫 번째 항목으로 설정
      const defaultAvatar = avatarList.find((av) => av.bodyType === 'STANDARD') || avatarList[0] || null;
      setSelectedAvatar(defaultAvatar);
      
      setStep(2);
    },
    onError: (error) => {
      console.error('아바타 템플릿 로딩 실패:', error);
      alert('신체 정보 로딩에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    },
  });

  const handleNextStep = (e) => {
    e.preventDefault();
    if (!gender) {
      alert('성별을 선택해 주세요.');
      return;
    }
    const h = Number(height);
    const w = Number(weight);
    if (h < 140 || h > 190) {
      alert('키는 140cm ~ 190cm 사이로 입력해 주세요.');
      return;
    }
    if (w < 40 || w > 90) {
      alert('몸무게는 40kg ~ 90kg 사이로 입력해 주세요.');
      return;
    }

    fetchTemplates({
      gender,
      heightId: mapHeightToId(height),
      weightId: mapWeightToId(weight),
    });
  };

  const handleComplete = () => {
    setStep(3);
  };

  // 이미지 로드 실패 시 대체로 보여줄 기본 마네킹 실루엣 SVG
  const handleImageError = (e) => {
    e.target.style.display = 'none';
    e.target.nextSibling.style.display = 'flex';
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4 py-8">
      {/* 마법사 위젯 카드 */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        
        {/* 상단 탭 헤더 */}
        <header className="bg-black text-white px-6 py-5 text-center">
          <p className="text-[10px] text-gray-400 font-medium tracking-wider uppercase">
            {step}단계 / 3단계 — {step === 1 ? '신체 정보' : step === 2 ? '체형 선택' : '완료'}
          </p>
          <h1 className="text-lg font-bold mt-1">프로필 / 마네킹 설정</h1>
        </header>

        {/* 상단 마네킹 캐릭터 실루엣 가시화 영역 */}
        <div className="flex flex-col items-center py-6 bg-gray-50/50 border-b border-gray-50">
          {/* 스텝 표시 점 */}
          <div className="flex gap-1.5 mb-4">
            <span className={`w-4 h-1.5 rounded-full transition-colors ${step === 1 ? 'bg-black' : 'bg-gray-200'}`}></span>
            <span className={`w-4 h-1.5 rounded-full transition-colors ${step === 2 ? 'bg-black' : 'bg-gray-200'}`}></span>
            <span className={`w-4 h-1.5 rounded-full transition-colors ${step === 3 ? 'bg-black' : 'bg-gray-200'}`}></span>
          </div>

          {/* 마네킹 이미지 또는 플레이스홀더 */}
          <div className="relative size-20 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200/60 overflow-hidden shadow-inner">
            {step === 1 ? (
              <svg className="size-10 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {selectedAvatar?.imageUrl ? (
                  <>
                    <img 
                      src={selectedAvatar.imageUrl} 
                      alt={selectedAvatar.bodyType}
                      onError={handleImageError}
                      className="object-contain w-full h-full p-1"
                    />
                    <svg className="size-10 text-gray-400 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </>
                ) : (
                  <svg className="size-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 바디 영역 */}
        <main className="p-6">
          {step === 1 && (
            <form onSubmit={handleNextStep} className="space-y-5">
              <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100/60 space-y-4">
                <h3 className="text-xs font-bold text-gray-400">신체 정보 입력</h3>
                
                {/* 성별 선택 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">*성별 (필수)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setGender('MALE')}
                      className={`py-3 text-sm font-semibold rounded-lg border transition ${
                        gender === 'MALE'
                          ? 'border-black bg-black text-white'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      남성
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('FEMALE')}
                      className={`py-3 text-sm font-semibold rounded-lg border transition ${
                        gender === 'FEMALE'
                          ? 'border-black bg-black text-white'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      여성
                    </button>
                  </div>
                </div>

                {/* 키, 몸무게 입력 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">키 (cm)</label>
                    <input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      placeholder="170"
                      required
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black transition"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">140~190cm</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">몸무게 (kg)</label>
                    <input
                      type="number"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="65"
                      required
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black transition"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">40~90kg</p>
                  </div>
                </div>
              </div>

              {/* 다음 단계 버튼 */}
              <button
                type="submit"
                disabled={isPending || !gender || !height || !weight}
                className="w-full py-3.5 text-sm font-bold text-white bg-black rounded-xl hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                {isPending ? '신체 정보 확인 중...' : '다음 >'}
              </button>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100/60">
                <h3 className="text-xs font-bold text-gray-400 mb-3.5">체형 선택</h3>
                
                {/* 체형 카드 선택 */}
                <div className="grid grid-cols-3 gap-2.5">
                  {avatars.map((av) => (
                    <button
                      key={av.id}
                      onClick={() => setSelectedAvatar(av)}
                      className={`flex flex-col items-center justify-between p-3 rounded-lg border bg-white transition aspect-square text-center ${
                        selectedAvatar?.id === av.id
                          ? 'border-black ring-1 ring-black'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {/* 체형 캐릭터 임시 아이콘 */}
                      <div className="w-10 h-10 flex items-center justify-center text-gray-400 mb-2">
                        {av.imageUrl ? (
                          <img 
                            src={av.imageUrl} 
                            alt={av.bodyType}
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                            className="object-contain w-full h-full"
                          />
                        ) : null}
                        <svg className={`size-8 ${av.imageUrl ? 'hidden' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-xs font-bold text-gray-700">
                        {BODY_TYPE_LABELS[av.bodyType] || av.bodyType}
                      </span>
                    </button>
                  ))}
                  
                  {/* 만약 API 응답이 비어있다면 목업 카드를 구성 */}
                  {avatars.length === 0 && (
                    ['SLIM', 'STANDARD', 'MUSCULAR'].map((type) => (
                      <button
                        key={type}
                        onClick={() => setSelectedAvatar({ id: type, bodyType: type })}
                        className={`flex flex-col items-center justify-between p-3 rounded-lg border bg-white transition aspect-square text-center ${
                          selectedAvatar?.bodyType === type
                            ? 'border-black ring-1 ring-black'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="w-10 h-10 flex items-center justify-center text-gray-400 mb-2">
                          <svg className="size-8" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="text-xs font-bold text-gray-700">
                          {BODY_TYPE_LABELS[type]}
                        </span>
                      </button>
                    ))
                  )}
                </div>
                
                <p className="text-[10px] text-gray-400 text-center mt-4">
                  선택하지 않을래요 (기본 체형으로 진행)
                </p>
              </div>

              {/* 하단 제어 버튼 */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/2 py-3 text-sm font-bold text-center text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                >
                  이전
                </button>
                <button
                  type="button"
                  onClick={handleComplete}
                  className="w-1/2 py-3 text-sm font-bold text-center text-white bg-black rounded-xl hover:bg-gray-800 transition"
                >
                  완료
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center size-10 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 mb-2">
                  <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-base font-bold text-gray-900">아바타 설정이 완료되었습니다!</h2>
                <p className="text-xs text-gray-400 leading-normal">
                  설정한 마네킹으로 상품을 가상으로 입어볼 수 있어요.
                </p>
              </div>

              {/* 설정 요약 정보 */}
              <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100/60 space-y-4">
                <h3 className="text-xs font-bold text-gray-400 border-b border-gray-100 pb-2">실정 요약</h3>
                
                <div className="flex items-center gap-4">
                  {/* 선택된 캐릭터 실루엣 아이콘 */}
                  <div className="size-12 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                    {selectedAvatar?.imageUrl ? (
                      <img 
                        src={selectedAvatar.imageUrl} 
                        alt="설정 완료"
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                        className="object-contain w-full h-full p-1"
                      />
                    ) : null}
                    <svg className={`size-8 ${selectedAvatar?.imageUrl ? 'hidden' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs leading-relaxed">
                    <div className="flex gap-2">
                      <span className="text-gray-400 w-10">성별</span>
                      <span className="font-semibold text-gray-800">{gender === 'MALE' ? '남성' : '여성'}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-gray-400 w-10">키</span>
                      <span className="font-semibold text-gray-800">{height}cm</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-gray-400 w-10">몸무게</span>
                      <span className="font-semibold text-gray-800">{weight}kg</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-gray-400 w-10">체형</span>
                      <span className="font-semibold text-gray-800">
                        {selectedAvatar ? (BODY_TYPE_LABELS[selectedAvatar.bodyType] || selectedAvatar.bodyType) : '밸런스'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 하단 최종 이동 단추 */}
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => navigate('/recommendations')}
                  className="w-full py-3.5 text-sm font-bold text-white bg-black rounded-xl hover:bg-gray-900 transition"
                >
                  AI 추천으로 바로가기
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full py-3.5 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                >
                  메인으로
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
