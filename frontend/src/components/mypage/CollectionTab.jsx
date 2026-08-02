import { useState } from "react";
import ClothingPlaceholder from "@/components/mypage/ClothingPlaceholder";
import { MY_PAGE_SESSIONS } from "@/components/mypage/mypageData";

export default function CollectionTab() {
    const [category, setCategory] = useState("전체");
    const visible = category === "전체"
        ? MY_PAGE_SESSIONS.flatMap((session) => session.items.map((item) => [item, session.category]))
        : MY_PAGE_SESSIONS.filter((session) => session.category === category).flatMap((session) => session.items.map((item) => [item, session.category]));

    return (
        <section className="mx-auto max-w-5xl">
            <div className="flex border-b">
                {["전체", "아우터", "상의", "하의"].map((value) => (
                    <button key={value} type="button" onClick={() => setCategory(value)} className={`border-b-2 px-5 py-4 font-bold ${category === value ? "border-slate-950" : "border-transparent text-slate-400"}`}>
                        {value}
                    </button>
                ))}
            </div>
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map(([item, itemCategory]) => (
                    <article key={item} className="overflow-hidden rounded-3xl bg-slate-50">
                        <div className="relative">
                            <span className="absolute left-3 top-3 rounded bg-white px-2 py-1 text-xs font-bold text-slate-500">{itemCategory}</span>
                            <ClothingPlaceholder />
                        </div>
                        <p className="bg-white p-4 font-medium">{item}</p>
                    </article>
                ))}
            </div>
        </section>
    );
}
