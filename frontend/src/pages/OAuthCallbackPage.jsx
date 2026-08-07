import { useEffect } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";

import { reissueToken } from "@/api/auth";
import { getMyInfo } from "@/api/users";
import { useUserStore } from "@/stores/useUserStore";
import {
  removeAccessToken,
  setAccessToken,
} from "@/utils/tokenStorage";

let callbackPromise;

function completeKakaoLogin() {
  if (!callbackPromise) {
    callbackPromise = reissueToken().then(async (response) => {
      const accessToken = response.data?.accessToken || response.accessToken;

      if (!accessToken) {
        throw new Error("Access token is missing.");
      }

      setAccessToken(accessToken);

      const myInfoResponse = await getMyInfo();
      return myInfoResponse.data;
    });
  }

  return callbackPromise;
}

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const setUser = useUserStore((state) => state.setUser);

  useEffect(() => {
    let isActive = true;

    completeKakaoLogin()
      .then((user) => {
        if (!isActive) {
          return;
        }

        setUser({
          email: user.email,
          nickname: user.nickname,
          profileImageUrl: user.avatar?.imageUrl,
        });
        navigate("/", { replace: true });
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        removeAccessToken();
        navigate("/login", { replace: true });
      });

    return () => {
      isActive = false;
    };
  }, [navigate, setUser]);

  return (
    <main className="relative flex min-h-[calc(100vh-6rem)] min-w-[900px] items-center justify-center overflow-hidden px-12">

      <motion.div
        role="status"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-[500px] rounded-[28px] border border-white/80 bg-white px-10 py-11 text-center shadow-[0_24px_70px_rgba(15,23,42,0.1)]"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#FEE500] shadow-[0_12px_30px_rgba(95,83,0,0.14)]">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-[#191919]">
            <path d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.85 5.34 4.64 6.76l-1.18 4.37c-.1.38.33.68.66.46l5.16-3.43c.24.02.48.03.72.03 5.52 0 10-3.58 10-8.19S17.52 3 12 3Z" />
          </svg>
        </div>

        <h1 className="mt-6 text-xl font-semibold tracking-[-0.025em] text-slate-950">카카오 로그인 연결 중</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">계정 정보를 안전하게 확인하고 있어요.<br />잠시만 기다려 주세요.</p>

        <div className="mx-auto mt-7 flex w-fit items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2.5">
          {[0, 1, 2].map((index) => (
            <motion.span
              key={index}
              animate={{ y: [0, -4, 0], opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: index * 0.14, ease: "easeInOut" }}
              className="h-1.5 w-1.5 rounded-full bg-[#253129]"
            />
          ))}
        </div>
      </motion.div>
    </main>
  );
}
