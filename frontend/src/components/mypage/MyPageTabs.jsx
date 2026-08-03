import PageContainer from "@/components/common/PageContainer";
import { MY_PAGE_TABS } from "@/components/mypage/mypageData";

export default function MyPageTabs({ activeTab, onChange }) {
    return (
        <nav className="border-b border-slate-100">
            <PageContainer className="flex gap-8">
                {MY_PAGE_TABS.map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => onChange(id)}
                        className={`border-b-2 px-1 py-5 text-lg font-semibold ${activeTab === id ? "border-slate-950 text-slate-950" : "border-transparent text-slate-400 hover:text-slate-700"}`}
                    >
                        {label}
                    </button>
                ))}
            </PageContainer>
        </nav>
    );
}
