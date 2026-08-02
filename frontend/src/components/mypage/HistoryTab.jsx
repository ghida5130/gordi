import ClothingPlaceholder from "@/components/mypage/ClothingPlaceholder";
import { MY_PAGE_SESSIONS } from "@/components/mypage/mypageData";

export default function HistoryTab() {
    return (
        <section className="mx-auto max-w-7xl">
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-bold">내 기록</h1>
                    <p className="mt-1 text-slate-400">지난 추천 · 결과 과정 · 패션 목록</p>
                </div>
                <small className="text-slate-400">총 3개 세션</small>
            </div>
            <div className="mt-8 space-y-5">
                {MY_PAGE_SESSIONS.map((session) => (
                    <article key={session.date} className="rounded-3xl border border-slate-100 p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <span className="rounded-full bg-slate-950 px-3 py-1.5 text-sm font-bold text-white">같이 고르기</span>
                                <span className="text-lg text-slate-500">{session.date}</span>
                            </div>
                            <div className="flex items-center gap-5">
                                <span className="text-right text-sm text-slate-500">예산<br /><b className="text-slate-900">{session.budget}</b></span>
                                <button type="button" className="rounded-full bg-slate-950 px-4 py-2 font-bold text-white">결과 보기</button>
                            </div>
                        </div>
                        <p className="mt-5 text-slate-500">카테고리: <b className="text-slate-900">{session.category}</b> · 고르기: <b className="text-slate-900">{session.count}개 확정</b></p>
                        <div className={`mt-5 grid gap-4 ${session.items.length === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
                            {session.items.map((item, index) => (
                                <div key={item} className="text-center">
                                    <ClothingPlaceholder rank={index + 1} />
                                    <p className="mt-3 font-medium text-slate-600">{item}</p>
                                </div>
                            ))}
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
