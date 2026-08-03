import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { login, startKakaoLogin } from "@/api/auth";
import { getMyInfo } from "@/api/users";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useUserStore } from "@/stores/useUserStore";
import { useToast } from "@/hooks/useToast";
// 💡 토큰 저장 함수 불러오기
import { setAccessToken } from "@/utils/tokenStorage";

export default function LoginPage() {
    const navigate = useNavigate();
    const toast = useToast();
    const [searchParams] = useSearchParams();
    const setUser = useUserStore((state) => state.setUser);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // ⭐️ 최신 로그인 API 명세서 반영
    const { mutate, isPending } = useMutation({
        mutationFn: login,
        onSuccess: async (response) => {
            // 1. 응답 데이터에서 Access Token 추출
            const accessToken = response.data?.data?.accessToken || response.data?.accessToken;

            // 2. 토큰을 스토리지에 저장
            if (accessToken) {
                setAccessToken(accessToken);
            }

            try {
                const myInfoResponse = await getMyInfo();
                const user = myInfoResponse.data;

                setUser({
                    email: user.email,
                    nickname: user.nickname,
                    profileImageUrl: user.avatar?.imageUrl,
                });

                toast.success("로그인에 성공했습니다.");

                // 3. 메인(홈) 화면으로 이동
                navigate("/");
            } catch (error) {
                console.error("사용자 정보 조회 실패:", error);
                toast.error("사용자 정보를 불러오지 못했습니다. 다시 시도해주세요.");
            }
        },
        onError: (error) => {
            // 4. 상태 코드별 맞춤 에러 메시지 띄우기
            const status = error.response?.status;

            if (status === 401) {
                toast.error("이메일 또는 비밀번호가 일치하지 않습니다.");
            } else if (status === 400) {
                toast.warning("입력하신 정보의 형식이 올바르지 않습니다.");
            } else {
                console.error("로그인 실패:", error);
                toast.error("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
            }
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!email || !password) {
            toast.warning("이메일과 비밀번호를 모두 입력해주세요.");
            return;
        }

        // 백엔드 명세서에 맞게 email, password 전송
        mutate({ email, password });
    };

    const handleTemporaryLogin = () => {
        setAccessToken("temporary-access-token");
        setUser({
            email: "test@gordi.local",
            nickname: "테스트 사용자",
            profileImageUrl: null,
        });
        toast.success("임시 계정으로 로그인했습니다.");
        navigate("/");
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-sm border border-gray-100">
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

                    <button type="submit" disabled={isPending} className="w-full py-3 mt-4 text-sm font-bold text-white bg-black rounded-lg hover:bg-gray-800 disabled:bg-gray-300 transition">
                        {isPending ? "로그인 중..." : "로그인"}
                    </button>

                    <button
                        type="button"
                        onClick={handleTemporaryLogin}
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:border-gray-500 hover:bg-gray-50 hover:text-black"
                    >
                        임시 로그인
                    </button>
                </form>

                <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-xs text-gray-400">또는</span>
                    <div className="h-px flex-1 bg-gray-200" />
                </div>

                {searchParams.get("error") === "oauth" && (
                    <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                        카카오 로그인에 실패했습니다. 다시 시도해 주세요.
                    </p>
                )}

                <button
                    type="button"
                    onClick={startKakaoLogin}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#FEE500] px-4 py-3 text-sm font-bold text-[#191919] transition hover:bg-[#F5DC00]"
                >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                        <path d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.85 5.34 4.64 6.76l-1.18 4.37c-.1.38.33.68.66.46l5.16-3.43c.24.02.48.03.72.03 5.52 0 10-3.58 10-8.19S17.52 3 12 3Z" />
                    </svg>
                    카카오로 로그인
                </button>

                <div className="text-sm text-center text-gray-500 pt-4">
                    계정이 없으신가요?{" "}
                    <Link to="/signup" className="text-blue-500 hover:underline ml-1">
                        회원가입
                    </Link>
                </div>
            </div>
        </div>
    );
}
