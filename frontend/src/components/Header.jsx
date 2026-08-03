import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { logout } from "@/api/auth";
import { useToast } from "@/hooks/useToast";
import { useUserStore } from "@/stores/useUserStore";
import { removeBodyInformation } from "@/utils/bodyInformationStorage";
import { removeRoomSession } from "@/utils/roomSessionStorage";
import { getAccessToken, removeAccessToken } from "@/utils/tokenStorage";

export default function Header() {
    const navigate = useNavigate();
    const toast = useToast();
    const { isLogin, clearUser } = useUserStore();
    const [hoveredMenu, setHoveredMenu] = useState(null);
    const isLoggedIn = isLogin || !!getAccessToken();

    const logoutMutation = useMutation({
        mutationFn: logout,
        onSettled: () => {
            removeAccessToken();
            removeBodyInformation();
            removeRoomSession();
            clearUser();
            toast.success("로그아웃되었습니다.");
            navigate("/login", { replace: true });
        },
    });

    const closeMenu = () => setHoveredMenu(null);

    return (
        <div className="relative z-50 border-b border-gray-100 bg-white">
            <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
                <Link to="/" className="flex items-center gap-2" onMouseEnter={closeMenu}>
                    <svg className="h-6 w-6 text-black" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 10a3 3 0 1 0-3-3" />
                        <path d="M12 10L2.5 16.5A1.5 1.5 0 0 0 3.5 19h17a1.5 1.5 0 0 0 1-2.5L12 10z" />
                    </svg>
                    <span className="text-xl font-bold tracking-tight text-black">gordi</span>
                </Link>

                <nav className="flex h-full items-center gap-8">
                    <button type="button" onMouseEnter={() => setHoveredMenu("tier")} className="h-full font-semibold text-gray-700 transition-colors hover:text-black">
                        티어메이커
                    </button>
                    <button type="button" onMouseEnter={() => setHoveredMenu("clothes")} className="h-full font-semibold text-gray-500 transition-colors hover:text-black">
                        AI 의상 추천
                    </button>
                </nav>

                <div className="flex items-center gap-5" onMouseEnter={closeMenu}>
                    {isLoggedIn ? (
                        <>
                            <button
                                type="button"
                                onClick={() => logoutMutation.mutate()}
                                disabled={logoutMutation.isPending}
                                className="text-sm font-semibold text-gray-500 transition-colors hover:text-black disabled:opacity-50"
                            >
                                {logoutMutation.isPending ? "로그아웃 중..." : "로그아웃"}
                            </button>
                            <Link to="/mypage" aria-label="마이페이지" className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-gray-200 text-gray-500 transition-colors hover:border-black hover:text-black">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link to="/signup" className="text-sm font-semibold text-gray-500 transition-colors hover:text-black">회원가입</Link>
                            <Link to="/login" className="text-sm font-semibold text-black transition-colors hover:text-gray-600">로그인</Link>
                        </>
                    )}
                </div>
            </header>

            {hoveredMenu && (
                <div className="absolute left-0 top-full w-full border-b border-gray-100 bg-white shadow-lg shadow-gray-100/50" onMouseLeave={closeMenu}>
                    <div className="mx-auto grid max-w-4xl gap-8 px-6 py-8 md:grid-cols-[1fr_auto] md:items-center">
                        {hoveredMenu === "tier" ? (
                            <>
                                <div>
                                    <p className="text-xs font-bold uppercase text-gray-400">Tier Maker</p>
                                    <h2 className="mt-2 text-xl font-bold text-gray-950">친구들과 추천 의상을 함께 비교해 보세요</h2>
                                    <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">AI가 추천한 의상을 티어별로 배치하고, 초대한 참여자와 실시간으로 의견을 모아 최종 의상을 결정할 수 있습니다.</p>
                                </div>
                                <div className="flex min-w-72 flex-col gap-2">
                                    <Link to="/recommendation" onClick={closeMenu} className="rounded-lg bg-black px-5 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-gray-800">의상 추천받고 티어메이커 시작하기</Link>
                                    <Link to="/rooms" state={{ openJoinForm: true }} onClick={closeMenu} className="rounded-lg border border-gray-200 px-5 py-3 text-center text-sm font-bold text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50">초대 코드로 참여하기</Link>
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <p className="text-xs font-bold uppercase text-gray-400">AI Recommendation</p>
                                    <h2 className="mt-2 text-xl font-bold text-gray-950">내 체형에 어울리는 의상을 추천받으세요</h2>
                                    <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">설정한 아바타와 체형 정보를 바탕으로 어울리는 상품을 분석해 의상 후보를 제안합니다.</p>
                                </div>
                                <Link to="/recommendation" onClick={closeMenu} className="min-w-72 rounded-lg bg-black px-5 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-gray-800">의상 추천 받기</Link>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
