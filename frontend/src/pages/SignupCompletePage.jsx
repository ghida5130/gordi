import { useNavigate } from "react-router-dom";

export default function SignupCompletePage() {
    const navigate = useNavigate();

    return (
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50 px-4 py-10">
            <section className="w-full max-w-lg rounded-lg border border-gray-100 bg-white p-8 text-center shadow-sm">
                <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <svg className="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m5 12 4 4L19 6" />
                    </svg>
                </span>
                <h1 className="mt-6 text-2xl font-bold text-gray-950">회원가입이 완료되었습니다</h1>
                <p className="mt-3 text-sm leading-6 text-gray-500">로그인하면 체형을 설정하고<br />나에게 어울리는 의상을 추천받을 수 있어요.</p>

                <div className="mt-8 space-y-3">
                    <button type="button" onClick={() => navigate("/login", { replace: true })} className="w-full rounded-lg bg-black px-4 py-3.5 text-sm font-bold text-white transition-colors hover:bg-gray-800">
                        로그인 하러가기
                    </button>
                    <button type="button" onClick={() => navigate("/", { replace: true })} className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50">
                        메인페이지로
                    </button>
                </div>
            </section>
        </main>
    );
}
