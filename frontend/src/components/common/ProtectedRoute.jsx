import { useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useToast } from "@/hooks/useToast";
import { getAccessToken } from "@/utils/tokenStorage";

function LoginRedirect() {
  const location = useLocation();
  const toast = useToast();
  const hasNotifiedRef = useRef(false);

  useEffect(() => {
    if (hasNotifiedRef.current) return;

    hasNotifiedRef.current = true;
    toast.info("로그인 후 이용하실 수 있습니다.");
  }, [toast]);

  const from = `${location.pathname}${location.search}${location.hash}`;

  return <Navigate to="/login" replace state={{ from }} />;
}

// access token이 필요한 라우트의 공통 진입 제어
function ProtectedRoute() {
  return getAccessToken() ? <Outlet /> : <LoginRedirect />;
}

export default ProtectedRoute;
