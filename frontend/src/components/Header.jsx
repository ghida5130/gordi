import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { logout } from "@/api/auth";
import bodyIcon from "@/assets/images/header/body.svg";
import shirtIcon from "@/assets/images/header/shirt.svg";
import { useToast } from "@/hooks/useToast";
import { useUserStore } from "@/stores/useUserStore";
import { removeBodyInformation } from "@/utils/bodyInformationStorage";
import { removeRoomSession } from "@/utils/roomSessionStorage";
import { getAccessToken, removeAccessToken } from "@/utils/tokenStorage";

const CONTENT_DISPLAY_DELAY_MS = 160;
const DESCRIPTION_DISPLAY_DELAY_MS = 100;
const TEXT_STAGGER_DELAY_MS = 90;

export default function Header() {
    const navigate = useNavigate();
    const toast = useToast();
    const { isLogin, clearUser } = useUserStore();
    const [hoveredMenu, setHoveredMenu] = useState(null);
    const [displayedMenu, setDisplayedMenu] = useState(null);
    const [showMenuActions, setShowMenuActions] = useState(false);
    const [showMenuDescription, setShowMenuDescription] = useState(false);
    const [animateMenuContent, setAnimateMenuContent] = useState(false);
    const contentDisplayTimerRef = useRef(null);
    const descriptionDisplayTimerRef = useRef(null);
    const isLoggedIn = isLogin || !!getAccessToken();

    useEffect(
        () => () => {
            window.clearTimeout(contentDisplayTimerRef.current);
            window.clearTimeout(descriptionDisplayTimerRef.current);
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
        window.clearTimeout(descriptionDisplayTimerRef.current);
        contentDisplayTimerRef.current = null;
        descriptionDisplayTimerRef.current = null;
    };

    const openMenu = (menu) => {
        if (hoveredMenu === menu && displayedMenu === menu) return;

        clearContentTimers();

        if (hoveredMenu) {
            setHoveredMenu(menu);
            setDisplayedMenu(menu);
            setShowMenuActions(true);
            setShowMenuDescription(true);
            setAnimateMenuContent(false);
            return;
        }

        setHoveredMenu(menu);
        setDisplayedMenu(menu);
        setShowMenuActions(false);
        setShowMenuDescription(false);
        setAnimateMenuContent(true);

        contentDisplayTimerRef.current = window.setTimeout(() => {
            setDisplayedMenu(menu);
            setShowMenuActions(true);
            contentDisplayTimerRef.current = null;
        }, CONTENT_DISPLAY_DELAY_MS);
        descriptionDisplayTimerRef.current = window.setTimeout(() => {
            setShowMenuDescription(true);
            descriptionDisplayTimerRef.current = null;
        }, DESCRIPTION_DISPLAY_DELAY_MS);
    };

    const closeMenu = () => {
        clearContentTimers();
        setHoveredMenu(null);
        setDisplayedMenu(null);
        setShowMenuActions(false);
        setShowMenuDescription(false);
        setAnimateMenuContent(false);
    };

    const actionsAnimationClass = `${showMenuActions ? "visible" : "invisible"} ${animateMenuContent && showMenuActions ? "header-content-bounce" : ""}`;
    const menuTextClass = (isVisible) => `transition-opacity duration-500 ease-out motion-reduce:transition-none ${isVisible ? "opacity-100" : "opacity-0"}`;
    const menuTextDelay = (isVisible, order) => ({
        transitionDelay: isVisible ? `${order * TEXT_STAGGER_DELAY_MS}ms` : "0ms",
    });

    return (
        <>
            <div aria-hidden="true" className={`pointer-events-none fixed inset-0 z-40 bg-slate-950/20 transition-opacity duration-500 ${hoveredMenu ? "opacity-100" : "opacity-0"}`} />
            <div className="fixed inset-x-0 top-0 z-50">
                <div
                    className={`relative mx-auto overflow-hidden border border-gray-200 bg-white transition-[height,width,max-width,margin-top,border-radius,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        hoveredMenu
                            ? "mt-0 h-[510px] w-full max-w-full rounded-none shadow-[0_22px_60px_rgba(15,23,42,0.28)]"
                            : "mt-3 h-[72px] w-[calc(100%_-_2rem)] max-w-6xl rounded-2xl shadow-[0_10px_30px_rgba(15,23,42,0.14)]"
                    }`}
                    onMouseLeave={closeMenu}
                >
                    <header
                        className={`relative mx-auto flex w-full max-w-[71rem] items-center justify-between px-6 transition-[height,padding] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${hoveredMenu ? "h-[84px] pt-3" : "h-[72px] pt-0"}`}
                    >
                        <Link to="/" className="group flex items-center gap-2.5" onMouseEnter={closeMenu}>
                            <svg
                                className="h-7 w-7 text-black transition-transform duration-300 group-hover:scale-110"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path d="M12 10a3 3 0 1 0-3-3" />
                                <path d="M12 10L2.5 16.5A1.5 1.5 0 0 0 3.5 19h17a1.5 1.5 0 0 0 1-2.5L12 10z" />
                            </svg>
                            <span className="text-2xl font-bold tracking-tight text-black transition-colors duration-300 group-hover:text-gray-600">gordi</span>
                        </Link>

                        <nav
                            className={`absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 transition-[top] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${hoveredMenu ? "top-[calc(50%+0.375rem)]" : "top-1/2"}`}
                        >
                            <button
                                type="button"
                                onMouseEnter={() => openMenu("body")}
                                onFocus={() => openMenu("body")}
                                aria-expanded={hoveredMenu === "body"}
                                className={`h-12 rounded-full px-5 text-base font-semibold transition-colors duration-300 ${hoveredMenu && hoveredMenu !== "body" ? "text-gray-400" : "text-gray-950"}`}
                            >
                                체형 설정
                            </button>

                            <button
                                type="button"
                                onMouseEnter={() => openMenu("clothes")}
                                onFocus={() => openMenu("clothes")}
                                aria-expanded={hoveredMenu === "clothes"}
                                className={`h-12 rounded-full px-5 text-base font-semibold transition-colors duration-300 ${hoveredMenu && hoveredMenu !== "clothes" ? "text-gray-400" : "text-gray-950"}`}
                            >
                                AI 의상 추천
                            </button>
                            <button
                                type="button"
                                onMouseEnter={() => openMenu("tier")}
                                onFocus={() => openMenu("tier")}
                                aria-expanded={hoveredMenu === "tier"}
                                className={`h-12 rounded-full px-5 text-base font-semibold transition-colors duration-300 ${hoveredMenu && hoveredMenu !== "tier" ? "text-gray-400" : "text-gray-950"}`}
                            >
                                티어메이커
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
                                    <Link
                                        to="/mypage"
                                        aria-label="마이페이지"
                                        className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-gray-200 text-gray-500 transition-all duration-300 hover:border-black hover:bg-black hover:text-white hover:shadow-md"
                                    >
                                        <svg
                                            width="20"
                                            height="20"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                        >
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                            <circle cx="12" cy="7" r="4" />
                                        </svg>
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <Link to="/signup" className="rounded-full px-4 py-2.5 text-base font-semibold text-gray-500 transition-colors duration-300 hover:bg-gray-100 hover:text-black">
                                        회원가입
                                    </Link>
                                    <Link
                                        to="/login"
                                        className="rounded-full bg-black px-5 py-2.5 text-base font-semibold text-white transition-all duration-300 hover:bg-gray-800 hover:shadow-md active:scale-95"
                                    >
                                        로그인
                                    </Link>
                                </>
                            )}
                        </div>
                    </header>

                    {displayedMenu && (
                        <div className="border-t border-gray-100">
                            <div className="mx-auto flex h-[400px] w-fit max-w-full justify-center gap-10 px-6 py-5">
                                {displayedMenu === "tier" ? (
                                    <>
                                        <Link
                                            to="/rooms"
                                            onClick={closeMenu}
                                            aria-label="티어메이커 시작하기"
                                            className={`group relative flex w-[260px] shrink-0 transform-gpu flex-col justify-between overflow-hidden rounded-[24px] bg-sky-400 p-7 text-white shadow-[0_18px_40px_rgba(14,165,233,0.2)] outline-none transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[0.97] hover:shadow-[0_10px_24px_rgba(14,165,233,0.18)] focus-visible:scale-[0.97] focus-visible:ring-4 focus-visible:ring-sky-200 active:scale-[0.95] ${actionsAnimationClass}`}
                                        >
                                            <span className="absolute right-6 top-6 flex size-11 items-center justify-center rounded-full border border-white/40 bg-white/15 text-xl">↗</span>
                                            <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-white text-sky-500 shadow-[0_22px_42px_-12px_rgba(3,105,161,0.48),0_6px_14px_-6px_rgba(3,105,161,0.28)] -rotate-3">
                                                <svg
                                                    aria-hidden="true"
                                                    viewBox="0 0 24 24"
                                                    className="size-12"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2.2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M12 10a3 3 0 1 0-3-3" />
                                                    <path d="M12 10 3 16.2A1.6 1.6 0 0 0 4 19h16a1.6 1.6 0 0 0 1-2.8L12 10Z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h2 className="mt-3 max-w-56 text-3xl font-bold leading-[1.02] tracking-tight flex flex-col gap-2">
                                                    <p>티어메이커</p>
                                                    <p>시작하기</p>
                                                </h2>
                                            </div>
                                        </Link>

                                        <section className="flex w-[650px] min-w-0 shrink-0 flex-col justify-center px-12">
                                            <div className="w-fit max-w-3xl">
                                                <h2 className="max-w-3xl text-3xl font-bold leading-[1.08] tracking-tight text-gray-950 flex flex-col gap-2">
                                                    <p className={menuTextClass(showMenuDescription)} style={menuTextDelay(showMenuDescription, 0)}>
                                                        추천 의상을 함께 비교하고
                                                    </p>
                                                    <p className={menuTextClass(showMenuDescription)} style={menuTextDelay(showMenuDescription, 1)}>
                                                        베스트 코디를 완성하세요
                                                    </p>
                                                </h2>
                                                <p className={`${menuTextClass(showMenuDescription)} mt-5 max-w-3xl text-sm leading-6 text-gray-500`} style={menuTextDelay(showMenuDescription, 2)}>
                                                    AI가 추천한 의상을 티어별로 나누고 참여자들과 의견을 실시간으로 공유할 수 있습니다.
                                                </p>
                                            </div>
                                        </section>
                                    </>
                                ) : displayedMenu === "clothes" ? (
                                    <>
                                        <Link
                                            to="/recommendation"
                                            onClick={closeMenu}
                                            aria-label="체형에 맞는 의상 추천받기"
                                            className={`group relative flex w-[260px] shrink-0 transform-gpu flex-col justify-between overflow-hidden rounded-[24px] bg-violet-500 p-7 text-white shadow-[0_18px_40px_rgba(139,92,246,0.22)] outline-none transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[0.97] hover:shadow-[0_10px_24px_rgba(139,92,246,0.18)] focus-visible:scale-[0.97] focus-visible:ring-4 focus-visible:ring-violet-200 active:scale-[0.95] ${actionsAnimationClass}`}
                                        >
                                            <span className="absolute right-6 top-6 flex size-11 items-center justify-center rounded-full border border-white/40 bg-white/15 text-xl">↗</span>
                                            <div className="flex size-28 items-center justify-center rounded-[28px] bg-violet-950 text-4xl font-black tracking-tighter shadow-[0_22px_42px_-12px_rgba(46,16,101,0.65),0_6px_14px_-6px_rgba(76,29,149,0.45)] rotate-5">
                                                <img src={shirtIcon} alt="" aria-hidden="true" className="size-15" />
                                            </div>
                                            <div>
                                                <h2 className="max-w-56 text-3xl font-bold leading-[1.02] tracking-tight flex flex-col gap-2">
                                                    <p>체형에 맞는</p>
                                                    <p>의상 추천받기</p>
                                                </h2>
                                            </div>
                                        </Link>

                                        <section className="flex w-[650px] min-w-0 shrink-0 flex-col justify-center px-12">
                                            <div className="w-fit max-w-3xl">
                                                <h2 className="max-w-3xl text-3xl font-bold leading-[1.08] tracking-tight text-gray-950 flex flex-col gap-2">
                                                    <p className={menuTextClass(showMenuDescription)} style={menuTextDelay(showMenuDescription, 0)}>
                                                        내 체형을 이해하는 AI가
                                                    </p>
                                                    <p className={menuTextClass(showMenuDescription)} style={menuTextDelay(showMenuDescription, 1)}>
                                                        어울리는 스타일을 찾아드려요
                                                    </p>
                                                </h2>
                                                <p className={`mt-5 max-w-3xl text-sm leading-6 text-gray-500`}>
                                                    <p className={menuTextClass(showMenuDescription)} style={menuTextDelay(showMenuDescription, 2)}>
                                                        등록한 체형과 아바타를 바탕으로 카테고리별 상품을 분석하고
                                                    </p>
                                                    <p className={menuTextClass(showMenuDescription)} style={menuTextDelay(showMenuDescription, 3)}>
                                                        나에게 잘 어울리는 의상 후보를 추천해 드립니다.
                                                    </p>
                                                </p>
                                            </div>
                                        </section>
                                    </>
                                ) : (
                                    <>
                                        <Link
                                            to="/mypage/avatar/edit"
                                            onClick={closeMenu}
                                            aria-label="맞춤형 체형 설정하기"
                                            className={`group relative flex w-[260px] shrink-0 transform-gpu flex-col justify-between overflow-hidden rounded-[24px] bg-emerald-500 p-7 text-white shadow-[0_18px_40px_rgba(16,185,129,0.22)] outline-none transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[0.97] hover:shadow-[0_10px_24px_rgba(16,185,129,0.18)] focus-visible:scale-[0.97] focus-visible:ring-4 focus-visible:ring-emerald-200 active:scale-[0.95] ${actionsAnimationClass}`}
                                        >
                                            <span className="absolute right-6 top-6 flex size-11 items-center justify-center rounded-full border border-white/40 bg-white/15 text-xl">↗</span>
                                            <div className="flex size-28 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-[0_22px_42px_-12px_rgba(5,150,105,0.48),0_6px_14px_-6px_rgba(5,150,105,0.28)] -rotate-3">
                                                <img src={bodyIcon} alt="" aria-hidden="true" className="size-15" />
                                            </div>
                                            <div>
                                                <h2 className="max-w-56 text-3xl font-bold leading-[1.02] tracking-tight flex flex-col gap-2">
                                                    <p>맞춤형 체형</p>
                                                    <p>설정하기</p>
                                                </h2>
                                            </div>
                                        </Link>

                                        <section className="flex w-[650px] min-w-0 shrink-0 flex-col justify-center px-12">
                                            <div className="w-fit max-w-3xl">
                                                <h2 className="max-w-3xl text-3xl font-bold leading-[1.08] tracking-tight text-gray-950 flex flex-col gap-2">
                                                    <p className={menuTextClass(showMenuDescription)} style={menuTextDelay(showMenuDescription, 0)}>
                                                        내 체형을 반영한 아바타로
                                                    </p>
                                                    <p className={menuTextClass(showMenuDescription)} style={menuTextDelay(showMenuDescription, 1)}>
                                                        더 정확한 추천을 받아보세요
                                                    </p>
                                                </h2>
                                                <p className={`mt-5 max-w-3xl text-sm leading-6 text-gray-500`}>
                                                    <p className={menuTextClass(showMenuDescription)} style={menuTextDelay(showMenuDescription, 2)}>
                                                        키와 체중 등 기본 체형 정보를 설정하면 나를 닮은 아바타를 만들고
                                                    </p>
                                                    <p className={menuTextClass(showMenuDescription)} style={menuTextDelay(showMenuDescription, 3)}>
                                                        체형에 맞춘 의상 추천과 가상 피팅에 활용할 수 있습니다.
                                                    </p>
                                                </p>
                                            </div>
                                        </section>
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
