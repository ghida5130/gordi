const toneClasses = {
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    info: "border-violet-100 bg-violet-50 text-violet-800",
    success: "border-emerald-100 bg-emerald-50 text-emerald-800",
    warning: "border-amber-100 bg-amber-50 text-amber-800",
    danger: "border-red-100 bg-red-50 text-red-700",
};

function StatusPanel({ children, tone = "neutral", className = "", role }) {
    return (
        <div
            role={role}
            className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${toneClasses[tone]} ${className}`}
        >
            {children}
        </div>
    );
}

export default StatusPanel;
