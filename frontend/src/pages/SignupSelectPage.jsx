import { startKakaoLogin } from "@/api/auth";
import { Link, useNavigate } from "react-router-dom";

export default function SignupSelectPage() {
    const navigate = useNavigate();

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-sm border border-gray-100 text-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">gordi 회원가입</h2>
                    <p className="mt-2 text-sm text-gray-400">원하시는 가입 방법을 선택해 주세요.</p>
                </div>

                <div className="space-y-4">
                    {/* 1. 카카오톡 회원가입 (OAuth 연동) */}
                    <button
                        type="button"
                        onClick={startKakaoLogin}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#FEE500] px-4 py-3 text-sm font-bold text-[#191919] transition hover:bg-[#F5DC00] active:scale-[0.98]"
                    >
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                            <path d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.85 5.34 4.64 6.76l-1.18 4.37c-.1.38.33.68.66.46l5.16-3.43c.24.02.48.03.72.03 5.52 0 10-3.58 10-8.19S17.52 3 12 3Z" />
                        </svg>
                        카카오톡으로 시작하기
                    </button>

                    {/* 2. 일반 이메일 회원가입 */}
                    <button
                        type="button"
                        onClick={() => navigate("/signup/email")}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition hover:border-gray-400 hover:bg-gray-50 hover:text-black active:scale-[0.98]"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                        </svg>
                        이메일로 시작하기
                    </button>
                </div>

                <div className="text-sm text-gray-500 pt-4 border-t border-gray-100">
                    이미 계정이 있으신가요?
                    <Link to="/login" className="text-blue-500 hover:underline ml-1.5 font-semibold">
                        로그인
                    </Link>
                </div>
            </div>
        </div>
    );
}
