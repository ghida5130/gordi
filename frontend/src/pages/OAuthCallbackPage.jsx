import { useEffect } from "react";
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
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div
        role="status"
        className="w-full max-w-sm rounded-lg border border-gray-100 bg-white p-8 text-center shadow-sm"
      >
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
        <p className="text-sm font-medium text-gray-700">
          카카오 로그인 처리 중입니다.
        </p>
      </div>
    </main>
  );
}
