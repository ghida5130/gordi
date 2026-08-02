import MyPageField from "@/components/mypage/MyPageField";
import MyPageIcon from "@/components/mypage/MyPageIcon";

function AvatarFigure() {
    return (
        <div className="relative mx-auto h-60 w-28" aria-label="아바타 미리보기">
            <span className="absolute left-1/2 top-0 size-9 -translate-x-1/2 rounded-full bg-[#c6ad85]" />
            <span className="absolute left-1/2 top-[-6px] h-2 w-14 -translate-x-1/2 rounded-sm bg-zinc-700" />
            <span className="absolute left-1/2 top-12 h-22 w-13 -translate-x-1/2 rounded-xl bg-zinc-800" />
            <span className="absolute left-0 top-14 h-16 w-6 rounded-full bg-zinc-800" />
            <span className="absolute right-0 top-14 h-16 w-6 rounded-full bg-zinc-800" />
            <span className="absolute left-6 top-34 h-22 w-6 rounded-lg bg-zinc-900" />
            <span className="absolute right-6 top-34 h-22 w-6 rounded-lg bg-zinc-900" />
        </div>
    );
}

export default function AvatarTab({ gender, setGender, bodyType, setBodyType, height, weight }) {
    return (
        <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <aside className="rounded-3xl border border-slate-200 p-6">
                <div className="flex justify-between">
                    <strong>내 아바타</strong>
                    <small className="text-slate-400">— {height}cm · {weight}kg</small>
                </div>
                <div className="mt-6"><AvatarFigure /></div>
                <div className="mt-7 grid grid-cols-3 border-t pt-5 text-center text-sm">
                    <span><small className="block text-slate-400">체형</small><b>{bodyType}</b></span>
                    <span className="border-x"><small className="block text-slate-400">키</small><b>{height}cm</b></span>
                    <span><small className="block text-slate-400">체중</small><b>{weight}kg</b></span>
                </div>
            </aside>
            <div className="space-y-5">
                <section className="rounded-3xl border border-slate-200 p-8">
                    <h1 className="text-2xl font-bold"><span className="mr-3 inline-flex size-8 items-center justify-center rounded-full bg-slate-950 text-base text-white">1</span>신체 정보 입력</h1>
                    <p className="mt-7 text-sm font-medium text-slate-600">성별 * (필수)</p>
                    <div className="mt-3 grid grid-cols-2 gap-4">
                        {["남성", "여성"].map((value) => (
                            <button key={value} type="button" onClick={() => setGender(value)} className={`rounded-2xl border py-4 font-bold ${gender === value ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 text-slate-600"}`}>
                                {value}
                            </button>
                        ))}
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-5">
                        <MyPageField label="↕ 키 (cm)" value={height} />
                        <MyPageField label="⚖ 몸무게 (kg)" value={weight} />
                    </div>
                    <button type="button" className="mt-7 w-full rounded-2xl bg-slate-100 py-4 font-bold text-slate-600">체형 템플릿 생성하기 →</button>
                </section>
                <section className="rounded-3xl border border-slate-200 p-8">
                    <h2 className="text-2xl font-bold"><span className="mr-3 inline-flex size-8 items-center justify-center rounded-full bg-slate-100 text-base text-slate-500">2</span>체형 선택</h2>
                    <div className="mt-7 grid grid-cols-3 gap-4">
                        {[["상체형", "어깨·가슴이 발달한 체형"], ["하체형", "엉덩이·허벅지가 발달한 체형"], ["밸런스", "상·하체 균형 잡힌 체형"]].map(([title, description]) => (
                            <button key={title} type="button" onClick={() => setBodyType(title)} className={`rounded-3xl border p-6 text-center ${bodyType === title ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-100"}`}>
                                <MyPageIcon name="user" className="mx-auto size-12 text-slate-400" />
                                <strong className="mt-3 block">{title}</strong>
                                <small className="mt-1 block text-slate-400">{description}</small>
                            </button>
                        ))}
                    </div>
                    <p className="mt-5 text-center text-sm text-slate-400">선택하지 않으면 기본 체형(밸런스)으로 저장됩니다</p>
                </section>
                <button type="button" className="w-full rounded-2xl bg-slate-300 py-4 font-bold text-slate-600">✓ 아바타 저장하기</button>
            </div>
        </section>
    );
}
