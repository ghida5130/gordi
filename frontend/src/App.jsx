import { RouterProvider } from "react-router-dom";

import { router } from "@/routes/router";

// 선언형 라우팅을 렌더링하는 애플리케이션 진입점
function App() {
  return <RouterProvider router={router} />;
}

export default App;
