import { RouterProvider } from "react-router-dom";
import { MotionConfig } from "motion/react";

import { router } from "@/routes/router";

// 선언형 라우팅을 렌더링하는 애플리케이션 진입점
function App() {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <RouterProvider router={router} />
    </MotionConfig>
  );
}

export default App;
