import { motion } from "motion/react";

import SurfaceCard from "@/components/common/SurfaceCard";

const toneClasses = {
    violet: "from-violet-100 to-sky-50 text-violet-700 ring-violet-100",
    danger: "from-red-100 to-amber-50 text-red-600 ring-red-100",
    success: "from-emerald-100 to-sky-50 text-emerald-700 ring-emerald-100",
};

function StatePage({ title, description, tone = "violet", icon, children, withinLayout = false }) {
    return (
        <main className={`flex min-w-[1180px] items-center justify-center px-8 py-16 text-slate-950 ${withinLayout ? "min-h-[calc(100vh-6rem)]" : "min-h-screen"}`}>
            <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-xl"
            >
                <SurfaceCard className="px-10 py-12 text-center">
                    <motion.span
                        initial={{ opacity: 0, rotate: -8, scale: 0.85 }}
                        animate={{ opacity: 1, rotate: 0, scale: 1 }}
                        transition={{ delay: 0.08, duration: 0.36 }}
                        className={`mx-auto flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl font-black ring-1 ring-inset ${toneClasses[tone]}`}
                        aria-hidden="true"
                    >
                        {icon}
                    </motion.span>
                    <h1 className="mt-7 text-3xl font-black tracking-tight">{title}</h1>
                    {description && <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-500">{description}</p>}
                    <div className="mt-8 flex justify-center">{children}</div>
                </SurfaceCard>
            </motion.div>
        </main>
    );
}

export default StatePage;
