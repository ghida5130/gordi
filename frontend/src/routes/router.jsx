import { createBrowserRouter } from "react-router-dom";
import RootLayout from "@/layouts/RootLayout";
import ApiExamplePage from "@/pages/ApiExamplePage";
import CreateRoomPage from "@/pages/CreateRoomPage";
import HomePage from "@/pages/HomePage";
import MainPage from "@/pages/MainPage"; // ⭐️ 새로 만든 MainPage 불러오기
import NotFoundPage from "@/pages/NotFoundPage";
import RoomLobbyPage from "@/pages/RoomLobbyPage";
import RoomPage from "@/pages/RoomPage";
import RouteErrorPage from "@/pages/RouteErrorPage";
import SignupPage from "@/pages/SignupPage";
import LoginPage from "@/pages/LoginPage";
import AvatarSetupPage from "@/pages/AvatarSetupPage";
import OAuthCallbackPage from "@/pages/OAuthCallbackPage";
import TierMakerRoomPage from "@/pages/TierMakerRoomPage";

// 화면과 URL의 대응 관계를 한곳에서 관리
export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        element: <MainPage />, // ⭐️ 기본 화면을 MainPage로 변경!
      },
      {
        path: "home",
        element: <HomePage />, // 기존 HomePage는 /home 주소로 빼두었습니다.
      },
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "signup",
        element: <SignupPage />,
      },
      {
        path: "rooms",
        element: <RoomLobbyPage />,
      },
      {
        path: "rooms/create",
        element: <CreateRoomPage />,
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
        path: "tierm",
        element: <TierMakerRoomPage />,
      },
      {
        path: "avatar/setup",
        element: <AvatarSetupPage />,
      },
      {
        path: "oauth/callback",
        element: <OAuthCallbackPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);