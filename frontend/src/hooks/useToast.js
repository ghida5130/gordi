import { useCallback, useMemo } from "react";
import { useToastStore } from "@/stores/useToastStore";

const DEFAULT_DURATION = 3000;

export function useToast() {
    const addToast = useToastStore((state) => state.addToast);

    const show = useCallback(
        (message, options = {}) =>
            addToast({
                message,
                type: options.type ?? "info",
                duration: options.duration ?? DEFAULT_DURATION,
            }),
        [addToast],
    );

    return useMemo(
        () => ({
            show,
            success: (message, options) => show(message, { ...options, type: "success" }),
            error: (message, options) => show(message, { ...options, type: "error" }),
            info: (message, options) => show(message, { ...options, type: "info" }),
            warning: (message, options) => show(message, { ...options, type: "warning" }),
        }),
        [show],
    );
}
