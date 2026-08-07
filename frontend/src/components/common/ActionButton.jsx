import { motion } from "motion/react";

const variantClasses = {
    primary: "bg-slate-950 text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)] hover:bg-slate-800",
    secondary: "border border-slate-200 bg-white text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.05)] hover:border-slate-300 hover:bg-slate-50",
    violet: "bg-violet-600 text-white shadow-[0_12px_28px_rgba(124,58,237,0.2)] hover:bg-violet-500",
    danger: "bg-red-600 text-white shadow-[0_12px_28px_rgba(220,38,38,0.16)] hover:bg-red-500",
};

const sizeClasses = {
    sm: "h-10 px-4 text-xs",
    md: "h-12 px-5 text-sm",
    lg: "h-14 px-7 text-sm",
};

function ActionButton({
    children,
    type = "button",
    variant = "primary",
    size = "md",
    className = "",
    disabled,
    ...props
}) {
    return (
        <motion.button
            type={type}
            disabled={disabled}
            whileHover={disabled ? undefined : { y: -2 }}
            whileTap={disabled ? undefined : { scale: 0.98 }}
            className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
            {...props}
        >
            {children}
        </motion.button>
    );
}

export default ActionButton;
