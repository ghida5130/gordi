import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { signup } from "@/api/auth";
import { useToast } from "@/hooks/useToast";
// 💡 프로젝트에 맞는 토큰 저장 함수 경로로 맞추어 주석을 해제하고 사용하세요.
// import { setAccessToken } from '@/utils/tokenStorage';

// 약관 및 정책 텍스트 정의
const TERMS_TEXT = `제1조 (목적)
본 약관은 서비스 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (회원의 의무)
① 회원은 가입 시 정확한 정보를 기재해야 합니다.
② 회원은 타인의 정보를 도용하여 가입할 수 없습니다.

제3조 (서비스의 제공)
회사는 회원에게 원활한 서비스를 제공하기 위해 최선을 다합니다.`;

const PRIVACY_TEXT = `1. 수집하는 개인정보 항목
- 필수항목: 이메일, 비밀번호, 닉네임
- 선택항목: 서비스 이용 기록

2. 개인정보의 수집 및 이용 목적
- 회원 가입 의사 확인, 회원제 서비스 제공에 따른 본인 식별 및 인증
- 서비스 부정이용 방지 및 비인가 사용 방지

3. 개인정보의 보유 및 이용 기간
- 원칙적으로 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다.`;

const MARKETING_TEXT = `1. 마케팅 및 광고에의 활용
- 신규 서비스(제품) 개발 및 맞춤 서비스 제공
- 이벤트 및 참여 기회 제공, 광고성 정보 제공

2. 수신 동의 거부
- 회원은 언제든지 마케팅 정보 수신 동의를 거부할 수 있으며, 거부 시에도 기본 서비스 이용에는 제한이 없습니다.`;

export default function SignupPage() {
    const navigate = useNavigate();
    const toast = useToast();

    // 폼 상태 관리
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [nickname, setNickname] = useState("");

    // 약관 동의 상태 관리
    const [agreements, setAgreements] = useState({
        terms: false,
        privacy: false,
        marketing: false,
    });

    // 팝업창(모달) 상태 관리
    const [modalContent, setModalContent] = useState(null);

    const openModal = (title, content) => {
        setModalContent({ title, content });
    };

    // 정규식 (유효성 검사)
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[!@#$%^&*?_]).{8,}$/;
    const nicknameRegex = /^[a-zA-Z가-힣0-9]{2,12}$/; // 특수문자 제외 2~12자

    // ⭐️ 수정됨: React-Query 회원가입 요청 (최신 API 명세서 반영)
    const { mutate, isPending } = useMutation({
        mutationFn: signup,
        onSuccess: (response) => {
            const accessToken = response.data?.data?.accessToken || response.data?.accessToken;
            const refreshToken = response.data?.data?.refreshToken || response.data?.refreshToken;

            if (accessToken) {
                // setAccessToken(accessToken);
            }
            if (refreshToken) {
                // 리프레시 토큰 저장 함수가 있다면 사용
            }

            toast.success("회원가입이 완료되었습니다.");
            // 가입 즉시 토큰이 발급되므로 홈 화면으로 이동합니다.
            navigate("/");
        },
        onError: (error) => {
            const status = error.response?.status;
            if (status === 409) {
                toast.error("이미 가입된 이메일이거나 중복된 닉네임입니다.");
            } else if (status === 400) {
                toast.warning("입력하신 정보의 형식이 올바르지 않습니다.");
            } else {
                console.error("회원가입 실패:", error);
                toast.error("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
            }
        },
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
            toast.warning("비밀번호는 영문, 숫자, 특수문자 포함 8자리 이상이어야 합니다.");
            return;
        }
        if (password !== passwordConfirm) {
            toast.warning("비밀번호가 일치하지 않습니다.");
            return;
        }
        if (!nicknameRegex.test(nickname)) {
            toast.warning("닉네임은 특수문자를 제외한 2~12글자로 입력해주세요.");
            return;
        }
        if (!agreements.terms || !agreements.privacy) {
            toast.warning("필수 이용약관에 동의해주세요.");
            return;
        }

        // ⭐️ 수정됨: 백엔드 명세서에 맞게 3가지 데이터만 전송
        mutate({
            email,
            password,
            nickname,
        });
    };

    const isAllChecked = agreements.terms && agreements.privacy && agreements.marketing;

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 py-10">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-sm border border-gray-100">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-4 p-4 border border-gray-100 rounded-lg bg-white">
                        <h3 className="text-xs font-bold text-gray-400">계정 정보</h3>

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
                                <button type="button" onClick={() => openModal("이용약관", TERMS_TEXT)} className="text-blue-500 hover:underline">
                                    보기
                                </button>
                            </label>

                            <label className="flex items-center justify-between text-xs cursor-pointer">
                                <div className="flex items-center space-x-2">
                                    <input type="checkbox" name="privacy" checked={agreements.privacy} onChange={handleSingleCheck} className="rounded text-black focus:ring-black" />
                                    <span className="text-gray-600">[필수] 개인정보 처리방침</span>
                                </div>
                                <button type="button" onClick={() => openModal("개인정보 처리방침", PRIVACY_TEXT)} className="text-blue-500 hover:underline">
                                    보기
                                </button>
                            </label>

                            <label className="flex items-center justify-between text-xs cursor-pointer">
                                <div className="flex items-center space-x-2">
                                    <input type="checkbox" name="marketing" checked={agreements.marketing} onChange={handleSingleCheck} className="rounded text-black focus:ring-black" />
                                    <span className="text-gray-600">[선택] 마케팅 정보 수신 동의</span>
                                </div>
                                <button type="button" onClick={() => openModal("마케팅 정보 수신 동의", MARKETING_TEXT)} className="text-blue-500 hover:underline">
                                    보기
                                </button>
                            </label>
                        </div>
                    </div>

                    <button type="submit" disabled={isPending} className="w-full py-3 mt-4 text-sm font-bold text-white bg-black rounded-lg hover:bg-gray-800 disabled:bg-gray-300 transition">
                        {isPending ? "처리 중..." : "회원가입 완료"}
                    </button>
                </form>

                <div className="text-sm text-center text-gray-500 pt-4">
                    이미 계정이 있으신가요?{" "}
                    <Link to="/login" className="text-blue-500 hover:underline ml-1">
                        로그인
                    </Link>
                </div>
            </div>

            {/* 팝업창(모달) */}
            {modalContent && (
                <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">{modalContent.title}</h3>

                        <div className="h-40 overflow-y-auto text-sm text-gray-600 mb-6 p-3 bg-gray-50 rounded border border-gray-100 whitespace-pre-wrap">{modalContent.content}</div>

                        <button onClick={() => setModalContent(null)} className="w-full py-2 bg-black text-white rounded-lg font-bold hover:bg-gray-800 transition">
                            닫기
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
