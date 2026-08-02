import { useLocation, useNavigate } from "react-router-dom";

export default function AvatarSetupCompletePage() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const summary = state ?? {};

    return (
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50 px-4 py-10">
            <section className="w-full max-w-lg rounded-lg border border-gray-100 bg-white p-8 shadow-sm">
                <div className="text-center">
                    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="m5 12 4 4L19 6" />
                        </svg>
                    </span>
                    <h1 className="mt-6 text-2xl font-bold text-gray-950">가입 및 체형 설정이 완료되었습니다</h1>
                    <p className="mt-3 text-sm text-gray-500">계정과 체형 정보가 모두 준비되었습니다.</p>
                </div>

                <div className="mt-7 flex items-center gap-5 rounded-lg border border-gray-100 bg-gray-50 p-5">
                    <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
                        {summary.imageUrl ? (
                            <img src={summary.imageUrl} alt="선택한 체형" className="h-full w-full object-contain" />
                        ) : (
                            <svg className="h-12 w-12 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                                <circle cx="12" cy="7" r="3" />
                                <path d="M7 21v-4a5 5 0 0 1 10 0v4M9 12l-2 5M15 12l2 5" />
                            </svg>
                        )}
                    </div>
                    <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm">
                        <dt className="text-gray-400">성별</dt>
                        <dd className="font-bold text-gray-800">{summary.gender === "MALE" ? "남성" : summary.gender === "FEMALE" ? "여성" : "미입력"}</dd>
                        <dt className="text-gray-400">키</dt>
                        <dd className="font-bold text-gray-800">{summary.height ? `${summary.height}cm` : "미입력"}</dd>
                        <dt className="text-gray-400">몸무게</dt>
                        <dd className="font-bold text-gray-800">{summary.weight ? `${summary.weight}kg` : "미입력"}</dd>
                        <dt className="text-gray-400">체형</dt>
                        <dd className="font-bold text-gray-800">{summary.bodyTypeLabel ?? "미선택"}</dd>
                    </dl>
                </div>

                <div className="mt-7 space-y-3">
                    <button type="button" className="w-full rounded-lg bg-black px-4 py-3.5 text-sm font-bold text-white hover:bg-gray-800">AI 의상 추천으로 바로가기</button>
                    <button type="button" onClick={() => navigate("/")} className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3.5 text-sm font-bold text-gray-700 hover:bg-gray-50">메인페이지로 이동</button>
                </div>
            </section>
        </main>
    );
}
