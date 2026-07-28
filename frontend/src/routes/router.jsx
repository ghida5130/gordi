import { createBrowserRouter } from 'react-router-dom'

import RootLayout from '@/layouts/RootLayout'
import ApiExamplePage from '@/pages/ApiExamplePage'
import HomePage from '@/pages/HomePage'
import NotFoundPage from '@/pages/NotFoundPage'
import RouteErrorPage from '@/pages/RouteErrorPage'
import LoginPage from '../pages/LoginPage'
import SignupPage from '@/pages/SignupPage'

// 화면과 URL의 대응 관계를 한곳에서 관리
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'examples/api',
        element: <ApiExamplePage />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'signup',
        element: <SignupPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
])
