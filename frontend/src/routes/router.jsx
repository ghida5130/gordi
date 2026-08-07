import { createBrowserRouter, Navigate } from "react-router-dom";
import RootLayout from "@/layouts/RootLayout";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import ApiExamplePage from "@/pages/ApiExamplePage";
import CreateRoomPage from "@/pages/CreateRoomPage";
import HomePage from "@/pages/HomePage";
import MainPage from "@/pages/MainPage"; // ⭐️ 새로 만든 MainPage 불러오기
import MainHeroDesignPage from "@/pages/MainHeroDesignPage";
import MainHeroCollaborationDesignPage from "@/pages/MainHeroCollaborationDesignPage";
import MainHeroCollaborationDesignV2Page from "@/pages/MainHeroCollaborationDesignV2Page";
import NotFoundPage from "@/pages/NotFoundPage";
import RoomLobbyPage from "@/pages/RoomLobbyPage";
import RoomInvitePage from "@/pages/RoomInvitePage";
import RoomPage from "@/pages/RoomPage";
import RouteErrorPage from "@/pages/RouteErrorPage";
import SignupPage from "@/pages/SignupPage";
import LoginPage from "@/pages/LoginPage";
import AvatarSetupPage from "@/pages/AvatarSetupPage";
import SignupCompletePage from "@/pages/SignupCompletePage";
import OAuthCallbackPage from "@/pages/OAuthCallbackPage";
import TierMakerRoomPage from "@/pages/TierMakerRoomPage";
import TierMakerResultPage from "@/pages/TierMakerResultPage";
import TierMakerDesignPage from "@/pages/TierMakerDesignPage";
import TierMakerRedesignPage from "@/pages/TierMakerRedesignPage";
import TierMakerRedesignV2Page from "@/pages/TierMakerRedesignV2Page";
import TierMakerJitterPage from "@/pages/TierMakerJitterPage";
import RecommendationPage from "@/pages/RecommendationPage";
import MyPage from "@/pages/MyPage";

// 화면과 URL의 대응 관계를 한곳에서 관리
export const router = createBrowserRouter([
    {
        path: "/tier-maker-redesign",
        element: <TierMakerRedesignPage />,
        errorElement: <RouteErrorPage />,
    },
    {
        path: "/tier-maker-redesign-v2",
        element: <TierMakerRedesignV2Page />,
        errorElement: <RouteErrorPage />,
    },
    {
        path: "/tier-maker-jitter",
        element: <TierMakerJitterPage />,
        errorElement: <RouteErrorPage />,
    },
    {
        path: "/",
        element: <RootLayout />,
        errorElement: <RouteErrorPage />,
        children: [
            {
                index: true,
                element: <MainPage />,
            },
            {
                path: "main-hero-design",
                element: <MainHeroDesignPage />,
            },
            {
                path: "main-hero-collaboration-design",
                element: <MainHeroCollaborationDesignPage />,
            },
            {
                path: "main-hero-collaboration-design-2",
                element: <MainHeroCollaborationDesignV2Page />,
            },
            {
                path: "home",
                element: <HomePage />,
            },
            {
                path: "login",
                element: <LoginPage />,
            },
            {
                path: "signup",
                element: <Navigate to="/signup/email" replace />,
            },
            {
                path: "signup/email",
                element: <SignupPage />,
            },
            {
                path: "rooms",
                element: <RoomLobbyPage />,
            },
            {
                path: "rooms/join/:roomCode",
                element: <RoomInvitePage />,
            },
            {
                path: "rooms/:roomId",
                element: <RoomPage />,
            },
            {
                path: "examples/api",
                element: <ApiExamplePage />,
            },
            {
                path: "rooms/:roomId/tier-maker",
                element: <TierMakerRoomPage />,
            },
            {
                path: "rooms/:roomCode/result",
                element: <TierMakerResultPage />,
            },
            {
                path: "tier-maker-design",
                element: <TierMakerDesignPage />,
            },
            {
                path: "signup/complete",
                element: <SignupCompletePage />,
            },
            {
                path: "oauth/callback",
                element: <OAuthCallbackPage />,
            },
            // 로그인이 필요한 페이지
            {
                element: <ProtectedRoute />,
                children: [
                    {
                        path: "rooms/create",
                        element: <CreateRoomPage />,
                    },
                    {
                        path: "rooms/create-test",
                        element: <CreateRoomPage />,
                    },
                    {
                        path: "recommendation",
                        element: <RecommendationPage />,
                    },
                    {
                        path: "mypage",
                        element: <MyPage />,
                    },
                    {
                        path: "mypage/avatar/edit",
                        element: <AvatarSetupPage />,
                    },
                ],
            },
            {
                path: "*",
                element: <NotFoundPage />,
            },
        ],
    },
]);
