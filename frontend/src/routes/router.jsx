import { createBrowserRouter, Navigate } from "react-router-dom";
import RootLayout from "@/layouts/RootLayout";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import CreateRoomPage from "@/pages/CreateRoomPage";
import MainPage from "@/pages/MainPage";
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
import RecommendationPage from "@/pages/RecommendationPage";
import MyPage from "@/pages/MyPage";

export const router = createBrowserRouter([
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
        path: "rooms/:roomId/tier-maker",
        element: <TierMakerRoomPage />,
      },
      {
        path: "rooms/:roomCode/result",
        element: <TierMakerResultPage />,
      },
      {
        path: "signup/complete",
        element: <SignupCompletePage />,
      },
      {
        path: "oauth/callback",
        element: <OAuthCallbackPage />,
      },
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
