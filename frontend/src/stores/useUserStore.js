import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

const initialState = {
  nickname: null,
  isLogin: false,
};

export const useUserStore = create(
  devtools(
    persist(
      (set) => ({
        ...initialState,
        setUser: ({ nickname }) =>
          set(
            {
              nickname: nickname ?? null,
              isLogin: true,
            },
            false,
            "user/setUser",
          ),
        updateUser: (user) =>
          set(
            (state) => ({
              nickname: user.nickname ?? state.nickname,
            }),
            false,
            "user/updateUser",
          ),
        clearUser: () => set(initialState, false, "user/clearUser"),
      }),
      {
        name: "user-storage",
        partialize: ({ nickname, isLogin }) => ({
          nickname,
          isLogin,
        }),
      },
    ),
    {
      name: "UserStore",
      enabled: import.meta.env.DEV,
    },
  ),
);
