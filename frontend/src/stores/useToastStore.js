import { create } from "zustand";

let nextToastId = 0;

export const useToastStore = create((set) => ({
    toasts: [],
    addToast: (toast) => {
        const id = ++nextToastId;

        set((state) => ({
            toasts: [...state.toasts, { ...toast, id }],
        }));

        return id;
    },
    removeToast: (id) =>
        set((state) => ({
            toasts: state.toasts.filter((toast) => toast.id !== id),
        })),
}));
