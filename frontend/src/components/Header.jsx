import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/useToast";
import { useUserStore } from "@/stores/useUserStore";
import { getAccessToken, removeAccessToken } from "@/utils/tokenStorage";

export default function Header() {
    const navigate = useNavigate();
    const toast = useToast();
    const { isLogin, clearUser } = useUserStore();
    const [hoveredMenu, setHoveredMenu] = useState(null);
    const isLoggedIn = isLogin || !!getAccessToken();

    const handleLogout = () => {
        removeAccessToken();
        clearUser();
        setHoveredMenu(null);
        navigate("/login");
    };

    return (
        <>
            <div className="relative z-50 border-b border-gray-100 bg-white">
                <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
                    <Link to="/" className="flex items-center gap-2" onMouseEnter={() => setHoveredMenu(null)}>
                        <svg className="h-6 w-6 text-black" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                            <path d="M12 10a3 3 0 1 0-3-3" />
                            <path d="M12 10L2.5 16.5A1.5 1.5 0 0 0 3.5 19h17a1.5 1.5 0 0 0 1-2.5L12 10z" />
                        </svg>
                        <span className="text-xl font-bold tracking-tight text-black">gordi</span>
                    </Link>

                    <nav className="flex h-full items-center gap-8">
                        <div className="flex h-full items-center" onMouseEnter={() => setHoveredMenu("tier")}>
                            {isLoggedIn ? (
                                <Link to="/rooms/create" className="font-semibold text-gray-900 transition-colors duration-300 hover:text-black">
                                    티어메이커
                                </Link>
                            ) : (
                                <button type="button" disabled className="font-semibold text-gray-400 transition-colors duration-300 hover:text-black" aria-describedby="login-required-notice">
                                    티어메이커
                                </button>
                            )}
                        </div>

                        <div className="flex h-full items-center" onMouseEnter={() => setHoveredMenu("clothes")}>
                            <Link to="/recommend-clothes" className="font-semibold text-gray-500 transition-colors duration-300 hover:text-black">
                                의상 추천
                            </Link>
                        </div>
                    </nav>

                    <div className="flex items-center gap-5" onMouseEnter={() => setHoveredMenu(null)}>
                        <button
                            type="button"
                            onClick={() => toast.success("Toast가 정상적으로 표시됩니다.")}
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition-colors duration-300 hover:border-gray-400 hover:bg-gray-50 hover:text-black"
                        >
                            Toast 테스트
                        </button>
                        {isLoggedIn ? (
                            <>
                                <button type="button" onClick={handleLogout} className="text-sm font-semibold text-gray-500 transition-colors duration-300 hover:text-black">
                                    로그아웃
                                </button>
                                <Link
                                    to="/mypage"
                                    aria-label="마이페이지"
                                    className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-gray-200 text-gray-500 transition-colors duration-300 hover:border-black hover:text-black"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                </Link>
                            </>
                        ) : (
                            <Link to="/login" className="text-sm font-semibold text-black transition-colors duration-300 hover:text-gray-600">
                                로그인
                            </Link>
                        )}
                    </div>
                </header>

                {hoveredMenu && (
                    <div className="absolute left-0 top-full w-full animate-slide-down border-b border-gray-100 bg-white shadow-lg shadow-gray-100/50" onMouseLeave={() => setHoveredMenu(null)}>
                        <div className="mx-auto flex max-w-6xl justify-center px-6 py-8">
                            {hoveredMenu === "tier" ? (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="flex gap-4">
                                        {isLoggedIn ? (
                                            <>
                                                <Link
                                                    to="/rooms/create"
                                                    onClick={() => setHoveredMenu(null)}
                                                    className="block w-64 rounded-lg bg-black p-6 text-white shadow-sm transition-colors duration-300 hover:bg-gray-800 hover:shadow-lg"
                                                >
                                                    <h3 className="mb-2 text-xl font-bold">방 생성하기</h3>
                                                    <p className="text-sm font-light text-gray-300">
                                                        새로운 티어 게임 방을 만들어
                                                        <br />
                                                        친구들을 초대해보세요 &rarr;
                                                    </p>
                                                </Link>
                                                <Link
                                                    to="/rooms"
                                                    state={{ openJoinForm: true }}
                                                    onClick={() => setHoveredMenu(null)}
                                                    className="block w-64 rounded-lg bg-[#1a1a1a] p-6 text-white shadow-sm transition-colors duration-300 hover:bg-black hover:shadow-lg"
                                                >
                                                    <h3 className="mb-2 text-xl font-bold">참여하기</h3>
                                                    <p className="text-sm font-light text-gray-300">
                                                        초대 코드를 입력하고
                                                        <br />
                                                        진행 중인 티어 게임방에 입장해 보세요 &rarr;
                                                    </p>
                                                </Link>
                                            </>
                                        ) : (
                                            <>
                                                <button type="button" disabled className="block w-64 rounded-lg bg-black p-6 text-left text-white opacity-40">
                                                    <h3 className="mb-2 text-xl font-bold">방 생성하기</h3>
                                                    <p className="text-sm font-light text-gray-300">
                                                        새로운 티어 게임 방을 만들어
                                                        <br />
                                                        친구들을 초대해보세요 &rarr;
                                                    </p>
                                                </button>
                                                <button type="button" disabled className="block w-64 rounded-lg bg-[#1a1a1a] p-6 text-left text-white opacity-40">
                                                    <h3 className="mb-2 text-xl font-bold">참여하기</h3>
                                                    <p className="text-sm font-light text-gray-300">
                                                        초대 코드를 입력하고
                                                        <br />
                                                        진행 중인 티어 게임방에 입장해 보세요 &rarr;
                                                    </p>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    {!isLoggedIn && (
                                        <p id="login-required-notice" className="text-sm text-gray-500">
                                            방 생성과 참여는 로그인 후 이용할 수 있습니다.
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <Link
                                    to="/recommend-clothes"
                                    onClick={() => setHoveredMenu(null)}
                                    className="block w-64 rounded-lg bg-black p-6 text-white shadow-sm transition-colors duration-300 hover:bg-gray-800 hover:shadow-lg"
                                >
                                    <h3 className="mb-2 text-xl font-bold">오늘의 의상 추천</h3>
                                    <p className="text-sm font-light text-gray-300">
                                        날씨와 기분에 맞는 완벽한
                                        <br />
                                        코디를 추천받아보세요 &rarr;
                                    </p>
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
