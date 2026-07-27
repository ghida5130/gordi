import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

const initialState = {
  email: null,
  nickname: null,
  profileImageUrl: null,
  isLogin: false,
};

// 로그인한 사용자의 화면 표시용 정보 관리
export const useUserStore = create(
  devtools(
    persist(
      (set) => ({
        ...initialState,
        setUser: ({ email, nickname, profileImageUrl }) =>
          set(
            {
              email: email ?? null,
              nickname: nickname ?? null,
              profileImageUrl: profileImageUrl ?? null,
              isLogin: true,
            },
            false,
            "user/setUser",
          ),
        updateUser: (user) =>
          set(
            (state) => ({
              email: user.email ?? state.email,
              nickname: user.nickname ?? state.nickname,
              profileImageUrl: user.profileImageUrl ?? state.profileImageUrl,
            }),
            false,
            "user/updateUser",
          ),
        clearUser: () => set(initialState, false, "user/clearUser"),
      }),
      {
        name: "user-storage",
        // 최소 사용자 정보와 로그인 여부만 저장
        partialize: ({ email, nickname, profileImageUrl, isLogin }) => ({
          email,
          nickname,
          profileImageUrl,
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
