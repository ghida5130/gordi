import MyPageIcon from "@/components/mypage/MyPageIcon";

export default function LogoutModal({ isPending, onCancel, onConfirm }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <section role="dialog" aria-modal="true" aria-labelledby="logout-title" className="w-full max-w-lg rounded-4xl bg-white px-13 py-14 text-center shadow-2xl">
                <span className="mx-auto flex size-18 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <MyPageIcon name="logout" className="size-9" />
                </span>
                <h2 id="logout-title" className="mt-6 text-3xl font-bold">로그아웃</h2>
                <p className="mt-3 text-lg text-slate-400">정말 로그아웃 하시겠습니까?</p>
                <div className="mt-10 grid grid-cols-2 gap-4">
                    <button type="button" onClick={onCancel} disabled={isPending} className="rounded-2xl bg-slate-100 py-4 text-lg font-bold text-slate-600">취소</button>
                    <button type="button" onClick={onConfirm} disabled={isPending} className="rounded-2xl bg-slate-950 py-4 text-lg font-bold text-white">{isPending ? "로그아웃 중..." : "로그아웃"}</button>
                </div>
            </section>
        </div>
    );
}
