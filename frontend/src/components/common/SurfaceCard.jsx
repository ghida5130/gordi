function SurfaceCard({ as: Component = "section", children, className = "", ...props }) {
    return (
        <Component
            className={`rounded-3xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)] ${className}`}
            {...props}
        >
            {children}
        </Component>
    );
}

export default SurfaceCard;
