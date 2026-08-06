import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useLocation, useOutlet } from 'react-router-dom'
import Header from "@/components/Header";
import Toast from "@/components/Toast";

const SCROLL_DIRECTION_THRESHOLD_PX = 4;
const TOP_SCROLL_THRESHOLD_PX = 8;

function RootLayout() {
  const { key: locationKey, pathname } = useLocation();
  const outlet = useOutlet();
  const isMainPage = pathname === "/";
  const isTierMakerRoomPage = /^\/rooms\/[^/]+\/tier-maker\/?$/.test(
    pathname,
  );
  const lastScrollYRef = useRef(0);
  const scrollFrameRef = useRef(null);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);

  useLayoutEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;

    window.history.scrollRestoration = "manual";

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    let secondFrameId = null;
    const resetScrollPosition = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      lastScrollYRef.current = 0;
      setIsHeaderHidden(false);
    };

    resetScrollPosition();

    const firstFrameId = window.requestAnimationFrame(() => {
      resetScrollPosition();
      secondFrameId = window.requestAnimationFrame(resetScrollPosition);
    });

    return () => {
      window.cancelAnimationFrame(firstFrameId);

      if (secondFrameId !== null) {
        window.cancelAnimationFrame(secondFrameId);
      }
    };
  }, [locationKey]);

  useEffect(() => {
    const updateHeaderVisibility = () => {
      scrollFrameRef.current = null;
      const currentScrollY = Math.max(window.scrollY, 0);
      const scrollDelta = currentScrollY - lastScrollYRef.current;

      if (currentScrollY <= TOP_SCROLL_THRESHOLD_PX) {
        setIsHeaderHidden(false);
        lastScrollYRef.current = 0;
      } else if (isTierMakerRoomPage) {
        setIsHeaderHidden(true);
        lastScrollYRef.current = currentScrollY;
      } else if (Math.abs(scrollDelta) >= SCROLL_DIRECTION_THRESHOLD_PX) {
        setIsHeaderHidden(scrollDelta > 0);
        lastScrollYRef.current = currentScrollY;
      }
    };
    const handleScroll = () => {
      if (scrollFrameRef.current !== null) return;

      scrollFrameRef.current = window.requestAnimationFrame(
        updateHeaderVisibility,
      );
    };
    const resetFrameId = window.requestAnimationFrame(() => {
      const currentScrollY = Math.max(window.scrollY, 0);

      lastScrollYRef.current = currentScrollY;
      setIsHeaderHidden(
        isTierMakerRoomPage && currentScrollY > TOP_SCROLL_THRESHOLD_PX,
      );
    });

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.cancelAnimationFrame(resetFrameId);

      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }

      window.removeEventListener("scroll", handleScroll);
    };
  }, [isTierMakerRoomPage, pathname]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 1. 모든 페이지 상단에 공통으로 띄울 헤더 */}
      <Header isHidden={isHeaderHidden} />
      <Toast />
      
      {/* 2. 라우터 주소에 따라 바뀌는 실제 페이지 내용들 */}
      <AnimatePresence mode="wait">
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.24 }}
          className={isMainPage ? "" : "pt-24"}
        >
          {outlet}
        </motion.main>
      </AnimatePresence>
    </div>
  )
}

export default RootLayout
