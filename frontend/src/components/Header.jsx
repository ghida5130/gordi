import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { logout } from "@/api/auth";
import { useToast } from "@/hooks/useToast";
import { useUserStore } from "@/stores/useUserStore";
import { removeBodyInformation } from "@/utils/bodyInformationStorage";
import { removeRoomSession } from "@/utils/roomSessionStorage";
import { getAccessToken, removeAccessToken } from "@/utils/tokenStorage";

const CONTENT_DISPLAY_DELAY_MS = 160;
const ACTIONS_DISPLAY_DELAY_MS = 270;

export default function Header() {
    const navigate = useNavigate();
    const toast = useToast();
    const { isLogin, clearUser } = useUserStore();
    const [hoveredMenu, setHoveredMenu] = useState(null);
    const [displayedMenu, setDisplayedMenu] = useState(null);
    const [showMenuActions, setShowMenuActions] = useState(false);
    const [animateMenuContent, setAnimateMenuContent] = useState(false);
    const contentDisplayTimerRef = useRef(null);
    const actionsDisplayTimerRef = useRef(null);
    const isLoggedIn = isLogin || !!getAccessToken();

    useEffect(
        () => () => {
            window.clearTimeout(contentDisplayTimerRef.current);
            window.clearTimeout(actionsDisplayTimerRef.current);
        },
        [],
    );

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

    const clearContentTimers = () => {
        window.clearTimeout(contentDisplayTimerRef.current);
        window.clearTimeout(actionsDisplayTimerRef.current);
        contentDisplayTimerRef.current = null;
        actionsDisplayTimerRef.current = null;
    };

    const openMenu = (menu) => {
        if (hoveredMenu === menu && displayedMenu === menu) return;

        clearContentTimers();

        if (hoveredMenu) {
            setHoveredMenu(menu);
            setDisplayedMenu(menu);
            setShowMenuActions(true);
            setAnimateMenuContent(false);
            return;
        }

        setHoveredMenu(menu);
        setDisplayedMenu(null);
        setShowMenuActions(false);
        setAnimateMenuContent(true);

        contentDisplayTimerRef.current = window.setTimeout(() => {
            setDisplayedMenu(menu);
            contentDisplayTimerRef.current = null;
        }, CONTENT_DISPLAY_DELAY_MS);
        actionsDisplayTimerRef.current = window.setTimeout(() => {
            setShowMenuActions(true);
            actionsDisplayTimerRef.current = null;
        }, ACTIONS_DISPLAY_DELAY_MS);
    };

    const closeMenu = () => {
        clearContentTimers();
        setHoveredMenu(null);
        setDisplayedMenu(null);
        setShowMenuActions(false);
        setAnimateMenuContent(false);
    };

    const descriptionAnimationClass = animateMenuContent ? "header-content-bounce" : "";
    const actionsAnimationClass = `${showMenuActions ? "visible" : "invisible"} ${animateMenuContent && showMenuActions ? "header-content-bounce" : ""}`;

    return (
        <>
            <div aria-hidden="true" className={`pointer-events-none fixed inset-0 z-40 bg-slate-950/20 transition-opacity duration-500 ${hoveredMenu ? "opacity-100" : "opacity-0"}`} />
            <div className={`fixed inset-x-0 top-0 z-50 transition-[padding] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${hoveredMenu ? "px-0 pt-0" : "px-4 pt-3"}`}>
                <div
                    className={`relative mx-auto w-full overflow-hidden border border-gray-200 bg-white transition-[height,max-width,border-radius,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        hoveredMenu
                            ? "h-[340px] max-w-[100vw] rounded-none shadow-[0_22px_60px_rgba(15,23,42,0.28)]"
                            : "h-[72px] max-w-6xl rounded-2xl shadow-[0_10px_30px_rgba(15,23,42,0.14)]"
                    }`}
                    onMouseLeave={closeMenu}
                >
                    <header className={`mx-auto flex w-[calc(100vw-2rem)] max-w-6xl items-center justify-between px-6 transition-[height,padding] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${hoveredMenu ? "h-[84px] pt-3" : "h-[72px] pt-0"}`}>
                    <Link to="/" className="group flex items-center gap-2.5" onMouseEnter={closeMenu}>
                        <svg className="h-7 w-7 text-black transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 10a3 3 0 1 0-3-3" />
                            <path d="M12 10L2.5 16.5A1.5 1.5 0 0 0 3.5 19h17a1.5 1.5 0 0 0 1-2.5L12 10z" />
                        </svg>
                        <span className="text-2xl font-bold tracking-tight text-black transition-colors duration-300 group-hover:text-gray-600">gordi</span>
                    </Link>

                    <nav className="flex h-full items-center gap-3">
                        <button type="button" onMouseEnter={() => openMenu("tier")} onFocus={() => openMenu("tier")} aria-expanded={hoveredMenu === "tier"} className={`h-12 rounded-full px-5 text-base font-semibold transition-all duration-300 ${hoveredMenu === "tier" ? "bg-black text-white shadow-md" : "text-gray-700 hover:bg-gray-100 hover:text-black"}`}>
                            티어메이커
                        </button>
                        <button type="button" onMouseEnter={() => openMenu("clothes")} onFocus={() => openMenu("clothes")} aria-expanded={hoveredMenu === "clothes"} className={`h-12 rounded-full px-5 text-base font-semibold transition-all duration-300 ${hoveredMenu === "clothes" ? "bg-black text-white shadow-md" : "text-gray-500 hover:bg-gray-100 hover:text-black"}`}>
                            AI 의상 추천
                        </button>
                    </nav>

                    <div className="flex items-center gap-3" onMouseEnter={closeMenu}>
                        {isLoggedIn ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => logoutMutation.mutate()}
                                    disabled={logoutMutation.isPending}
                                    className="rounded-full px-3 py-2 text-base font-semibold text-gray-500 transition-colors duration-300 hover:bg-gray-100 hover:text-black disabled:opacity-50"
                                >
                                    {logoutMutation.isPending ? "로그아웃 중..." : "로그아웃"}
                                </button>
                                <Link to="/mypage" aria-label="마이페이지" className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-gray-200 text-gray-500 transition-all duration-300 hover:scale-105 hover:border-black hover:bg-black hover:text-white hover:shadow-md">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link to="/signup" className="rounded-full px-4 py-2.5 text-base font-semibold text-gray-500 transition-colors duration-300 hover:bg-gray-100 hover:text-black">회원가입</Link>
                                <Link to="/login" className="rounded-full bg-black px-5 py-2.5 text-base font-semibold text-white transition-all duration-300 hover:scale-[1.03] hover:bg-gray-800 hover:shadow-md active:scale-95">로그인</Link>
                            </>
                        )}
                    </div>
                </header>

                    {displayedMenu && (
                        <div className="border-t border-gray-100">
                            <div className="mx-auto grid max-w-5xl gap-12 px-8 py-10 md:grid-cols-[1fr_auto] md:items-center">
                            {displayedMenu === "tier" ? (
                                <>
                                    <div className={descriptionAnimationClass}>
                                        <p className="text-sm font-bold uppercase tracking-[0.12em] text-gray-400">Tier Maker</p>
                                        <h2 className="mt-3 text-2xl font-bold text-gray-950">친구들과 추천 의상을 함께 비교해 보세요</h2>
                                        <p className="mt-3 max-w-2xl text-base leading-7 text-gray-500">AI가 추천한 의상을 티어별로 배치하고, 초대한 참여자와 실시간으로 의견을 모아 최종 의상을 결정할 수 있습니다.</p>
                                    </div>
                                    <div className={`flex min-w-80 flex-col gap-3 ${actionsAnimationClass}`}>
                                        <Link to="/recommendation" onClick={closeMenu} className="group flex items-center justify-between rounded-xl bg-black px-6 py-4 text-base font-bold text-white transition-all duration-300 hover:-translate-y-1 hover:bg-gray-800 hover:shadow-lg"><span>의상 추천받고 티어메이커 시작하기</span><span className="transition-transform duration-300 group-hover:translate-x-1">→</span></Link>
                                        <Link to="/rooms" state={{ openJoinForm: true }} onClick={closeMenu} className="group flex items-center justify-between rounded-xl border border-gray-200 px-6 py-4 text-base font-bold text-gray-700 transition-all duration-300 hover:-translate-y-1 hover:border-gray-400 hover:bg-gray-50 hover:shadow-md"><span>초대 코드로 참여하기</span><span className="transition-transform duration-300 group-hover:translate-x-1">→</span></Link>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className={descriptionAnimationClass}>
                                        <p className="text-sm font-bold uppercase tracking-[0.12em] text-gray-400">AI Recommendation</p>
                                        <h2 className="mt-3 text-2xl font-bold text-gray-950">내 체형에 어울리는 의상을 추천받으세요</h2>
                                        <p className="mt-3 max-w-2xl text-base leading-7 text-gray-500">설정한 아바타와 체형 정보를 바탕으로 어울리는 상품을 분석해 의상 후보를 제안합니다.</p>
                                    </div>
                                    <div className={actionsAnimationClass}>
                                        <Link to="/recommendation" onClick={closeMenu} className="group flex min-w-80 items-center justify-between rounded-xl bg-black px-6 py-4 text-base font-bold text-white transition-all duration-300 hover:-translate-y-1 hover:bg-gray-800 hover:shadow-lg"><span>의상 추천 받기</span><span className="transition-transform duration-300 group-hover:translate-x-1">→</span></Link>
                                    </div>
                                </>
                            )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
