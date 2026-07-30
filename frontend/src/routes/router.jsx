import { createBrowserRouter } from "react-router-dom";
import RootLayout from "@/layouts/RootLayout";
import ApiExamplePage from "@/pages/ApiExamplePage";
import CreateRoomPage from "@/pages/CreateRoomPage";
import HomePage from "@/pages/HomePage";
import NotFoundPage from "@/pages/NotFoundPage";
import RoomLobbyPage from "@/pages/RoomLobbyPage";
import RoomPage from "@/pages/RoomPage";
import RouteErrorPage from "@/pages/RouteErrorPage";
import SignupPage from "@/pages/SignupPage";
import LoginPage from "../pages/LoginPage";
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
        element: <HomePage />,
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
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "oauth/callback",
        element: <OAuthCallbackPage />,
      },
      {
        path: "signup",
        element: <SignupPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
