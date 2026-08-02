import ClothingPlaceholder from "@/components/mypage/ClothingPlaceholder";
import MyPageField from "@/components/mypage/MyPageField";
import MyPageIcon from "@/components/mypage/MyPageIcon";
import { MY_PAGE_SESSIONS } from "@/components/mypage/mypageData";

function SessionCard({ session }) {
    return (
        <article className="overflow-hidden rounded-3xl border border-slate-100 bg-white">
            <div className="relative">
                <span className="absolute left-3 top-3 rounded-full bg-slate-950 px-2.5 py-1 text-xs font-bold text-white">같이 고르기</span>
                <ClothingPlaceholder />
            </div>
            <div className="p-5">
                <p className="font-bold">{session.category} · {session.count}개 확정</p>
                <p className="mt-1 text-sm text-slate-400">{session.date}</p>
                <p className="text-xs text-slate-400">{session.budget}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {session.items.slice(0, 2).map((item) => (
                        <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{item}</span>
                    ))}
                    {session.items.length > 2 && <span className="py-1 text-xs text-slate-400">+1개</span>}
                </div>
            </div>
        </article>
    );
}

function Stat({ icon, value, label }) {
    return (
        <div className="text-center">
            <MyPageIcon name={icon} className="mx-auto size-5 text-slate-400" />
            <strong className="mt-1 block text-xl">{value}</strong>
            <small className="text-slate-400">{label}</small>
        </div>
    );
}

export function ProfileHome({ nickname, profileImageUrl, height, weight, onEdit, onHistory }) {
    return (
        <>
            <section className="flex items-center justify-between border-b border-slate-100 pb-10">
                <div className="flex items-center gap-5">
                    {profileImageUrl ? (
                        <img src={profileImageUrl} alt="프로필" className="size-20 rounded-full object-cover" />
                    ) : (
                        <div className="flex size-20 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                            <MyPageIcon name="user" className="size-10" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold">{nickname}</h1>
                        <p className="mt-1 text-lg text-slate-400">밸런스형 · {height}cm · {weight}kg</p>
                    </div>
                </div>
                <div className="flex items-center gap-7">
                    <Stat icon="bookmark" value="8" label="모아보기" />
                    <Stat icon="heart" value="4" label="좋아요" />
                    <Stat icon="check" value="5" label="확정 의상" />
                    <button type="button" onClick={onEdit} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-base font-semibold hover:bg-slate-50">
                        <MyPageIcon name="edit" className="size-5" />
                        프로필 수정
                    </button>
                </div>
            </section>
            <section className="pt-11">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">최근 추천 세션 <span className="text-blue-500">3</span></h2>
                    <button type="button" onClick={onHistory} className="text-sm font-medium text-slate-400 hover:text-slate-700">전체 보기 〉</button>
                </div>
                <div className="mt-6 grid gap-5 md:grid-cols-3">
                    {MY_PAGE_SESSIONS.map((session) => <SessionCard key={session.date} session={session} />)}
                </div>
            </section>
        </>
    );
}

export function ProfileEdit({ nickname, profileImageUrl, onCancel }) {
    return (
        <section className="mx-auto max-w-2xl">
            <button type="button" onClick={onCancel} className="text-sm font-medium text-slate-400 hover:text-slate-950">〈 프로필</button>
            <h1 className="mt-3 text-2xl font-bold">프로필 수정</h1>
            <p className="mt-1 text-slate-400">계정 정보를 변경합니다</p>
            <div className="mt-8 rounded-3xl border border-slate-200 p-9">
                <div className="flex justify-center">
                    {profileImageUrl ? (
                        <img src={profileImageUrl} alt="프로필" className="size-26 rounded-full object-cover" />
                    ) : (
                        <div className="flex size-26 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                            <MyPageIcon name="user" className="size-12" />
                        </div>
                    )}
                </div>
                <div className="mt-8 space-y-5">
                    <MyPageField label="아이디" value="kiminjun" readOnly />
                    <MyPageField label="이름" value={nickname} />
                    <MyPageField label="새 비밀번호" placeholder="새 비밀번호를 입력하세요" type="password" />
                    <MyPageField label="비밀번호 확인" placeholder="비밀번호를 다시 입력하세요" type="password" />
                </div>
                <div className="mt-8 grid grid-cols-2 gap-3">
                    <button type="button" onClick={onCancel} className="rounded-2xl bg-slate-100 py-4 font-bold text-slate-600">취소</button>
                    <button type="button" onClick={onCancel} className="rounded-2xl bg-slate-950 py-4 font-bold text-white">저장하기</button>
                </div>
            </div>
        </section>
    );
}
