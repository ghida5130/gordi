import { motion } from "motion/react";

import PageContainer from "@/components/common/PageContainer";
import { MY_PAGE_TABS } from "@/components/mypage/mypageData";

export default function MyPageTabs({ activeTab, onChange }) {
    return (
        <nav className="border-b border-slate-200">
            <PageContainer className="flex gap-2 py-3">
                {MY_PAGE_TABS.map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => onChange(id)}
                        aria-current={activeTab === id ? "page" : undefined}
                        className={`relative rounded-full px-5 py-2.5 text-sm font-bold transition-colors ${activeTab === id ? "text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}
                    >
                        {activeTab === id && (
                            <motion.span
                                layoutId="mypage-active-tab"
                                className="absolute inset-0 rounded-full bg-slate-950 shadow-[0_8px_22px_rgba(15,23,42,0.2)]"
                                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                            />
                        )}
                        <span className="relative z-10">{label}</span>
                    </button>
                ))}
            </PageContainer>
        </nav>
    );
}
