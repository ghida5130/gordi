import { useNavigate } from "react-router-dom";

export default function AvatarSetupPrompt() {
    const navigate = useNavigate();

    return (
        <section className="mx-auto flex w-full max-w-xl flex-col items-center rounded-3xl border border-slate-100 bg-white px-6 py-14 text-center shadow-sm">
            <span className="flex size-16 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <svg className="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="7" r="3" />
                    <path d="M7 21v-4a5 5 0 0 1 10 0v4M9 12l-2 5M15 12l2 5" />
                </svg>
            </span>
            <h1 className="mt-6 text-xl font-bold text-slate-950">아바타를 설정해 주세요</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">체형 정보를 통해 아바타를 설정하고 의상을 추천받아보세요</p>
            <button type="button" onClick={() => navigate("/mypage/avatar/edit")} className="mt-7 rounded-xl bg-slate-950 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800">
                체형 설정하기
            </button>
        </section>
    );
}
