import { useEffect, useState } from "react";
import { useToastStore } from "@/stores/useToastStore";

const EXIT_DURATION = 260;

const toastStyles = {
    success: "text-emerald-950",
    error: "text-red-950",
    warning: "text-amber-950",
    info: "text-gray-950",
};

const dotStyles = {
    success: "bg-emerald-500 ring-emerald-100/80",
    error: "bg-red-500 ring-red-100/80",
    warning: "bg-amber-500 ring-amber-100/80",
    info: "bg-gray-600 ring-gray-200/80",
};

function ToastItem({ toast, onClose }) {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        if (toast.duration === 0) return undefined;

        const timer = window.setTimeout(() => setIsExiting(true), toast.duration);
        return () => window.clearTimeout(timer);
    }, [toast.duration]);

    useEffect(() => {
        if (!isExiting) return undefined;

        const timer = window.setTimeout(() => onClose(toast.id), EXIT_DURATION);
        return () => window.clearTimeout(timer);
    }, [isExiting, onClose, toast.id]);

    return (
        <div
            className={`toast-liquid-glass relative h-15 overflow-hidden rounded-full border border-white/75 ${isExiting ? "toast-exiting" : ""} ${toastStyles[toast.type] ?? toastStyles.info}`}
            role={toast.type === "error" ? "alert" : "status"}
        >
            <div className="toast-liquid-content absolute left-1/2 top-0 flex h-full w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 box-border items-center gap-4 px-5">
                <span className={`block h-3 w-3 shrink-0 self-center rounded-full ring-4 ${dotStyles[toast.type] ?? dotStyles.info}`} aria-hidden="true" />
                <p className="min-w-0 flex-1 self-center text-base font-semibold leading-5">{toast.message}</p>
                {/* <button type="button" onClick={() => setIsExiting(true)} className="flex h-8 w-8 shrink-0 items-center justify-center leading-none text-gray-700 opacity-70" aria-label="알림 닫기">
                    &times;
                </button> */}
            </div>
        </div>
    );
}

export default function Toast() {
    const toasts = useToastStore((state) => state.toasts);
    const removeToast = useToastStore((state) => state.removeToast);

    if (toasts.length === 0) return null;

    return (
        <>
            <style>
                {`
                    @keyframes toastRise {
                        from {
                            opacity: 0;
                            transform: translateY(320px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }

                    @keyframes toastExpand {
                        from {
                            width: 60px;
                        }
                        to {
                            width: 100%;
                        }
                    }

                    @keyframes toastContentReveal {
                        from {
                            opacity: 0;
                        }
                        to {
                            opacity: 1;
                        }
                    }

                    @keyframes toastExit {
                        from {
                            opacity: 1;
                            transform: translateY(0);
                        }
                        to {
                            opacity: 0;
                            transform: translateY(18px);
                        }
                    }

                    .toast-liquid-glass {
                        background: rgba(201, 201, 201, 0.651);
                        backdrop-filter: blur(28px) saturate(180%);
                        -webkit-backdrop-filter: blur(28px) saturate(180%);
                        margin-inline: auto;
                        animation:
                            toastRise 700ms cubic-bezier(0.16, 1, 0.3, 1) both,
                            toastExpand 400ms 120ms cubic-bezier(0.16, 1, 0.3, 1) both;
                        transform-origin: bottom center;
                    }

                    .toast-liquid-content {
                        animation: toastContentReveal 280ms 250ms ease-out both;
                    }

                    .toast-liquid-glass.toast-exiting {
                        width: 100%;
                        animation: toastExit ${EXIT_DURATION}ms ease-in forwards;
                    }

                    @media (prefers-reduced-motion: reduce) {
                        .toast-liquid-glass,
                        .toast-liquid-content {
                            animation: none;
                        }
                    }
                `}
            </style>
            <div
                className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex max-h-[calc(100vh-3rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col gap-3"
                aria-live="polite"
                aria-atomic="false"
            >
                {toasts.map((toast) => (
                    <div key={toast.id} className="pointer-events-auto">
                        <ToastItem toast={toast} onClose={removeToast} />
                    </div>
                ))}
            </div>
        </>
    );
}
