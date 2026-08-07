import { motion } from "motion/react";
import { Link } from "react-router-dom";

import OrganicTierCollaborationScene from "@/components/main/OrganicTierCollaborationScene";

const easeOut = [0.16, 1, 0.3, 1];

function Highlight({ children, color, delay }) {
  return (
    <span className="relative isolate inline-block px-1 font-extrabold">
      {children}
      <motion.span
        aria-hidden="true"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay, duration: 0.72, ease: easeOut }}
        className={`absolute inset-x-0 bottom-[0.08em] -z-10 h-[0.24em] origin-left rounded-full ${color}`}
      />
    </span>
  );
}

function MainHeroCollaborationDesignV2Page() {
  return (
    <div className="min-h-[calc(100vh-6rem)] min-w-[1180px] overflow-hidden bg-[#F3F3EF] font-sans text-[#202421]">
      <section className="relative flex min-h-[760px] items-center px-12 py-14">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(31,35,32,0.08) 1px, transparent 0)",
            backgroundSize: "24px 24px",
            maskImage: "linear-gradient(to right, black, transparent 48%, transparent)",
          }}
        />
        <div aria-hidden="true" className="absolute -left-36 top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full bg-white/75 blur-3xl" />

        <div className="relative mx-auto grid w-full max-w-[1380px] grid-cols-[500px_810px] items-center gap-[34px]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.72, ease: easeOut }}
            className="relative z-20"
          >
            <h1 className="text-[62px] font-thin leading-[1.07] tracking-[-0.055em] text-[#202421]">
              나만의 <Highlight color="bg-[#D9CDF8]" delay={0.44}>아바타</Highlight>로
              <br />
              친구들과 <Highlight color="bg-[#BFE7D2]" delay={0.58}>함께</Highlight>
              <br />
              의상 <Highlight color="bg-[#F8D4BF]" delay={0.72}>티어메이커</Highlight>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.62, ease: easeOut }}
              className="mt-7 max-w-[470px] text-[16px] font-medium leading-8 text-[#666D67]"
            >
              친구의 커서를 따라 같은 보드에서 의상을 움직이고, 함께 정한 코디를
              AI 가상 피팅으로 완성해보세요.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.58, ease: easeOut }}
              className="mt-9"
            >
              <Link
                to="/rooms"
                className="group inline-flex h-[58px] items-center gap-7 rounded-full bg-[#242925] px-7 text-[15px] font-semibold text-white shadow-[0_18px_38px_rgba(31,35,32,0.18)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_23px_44px_rgba(31,35,32,0.25)]"
              >
                친구들과 시작하기
                <span aria-hidden="true" className="text-xl transition-transform duration-300 group-hover:translate-x-1.5">→</span>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.54, duration: 0.55, ease: easeOut }}
              className="mt-8 flex items-center gap-4 text-[11px] font-bold text-[#6F766F]"
            >
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-violet-400" />
                커서 위치 공유
              </span>
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-400" />
                실시간 공동 편집
              </span>
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-orange-300" />
                AI 피팅
              </span>
            </motion.div>
          </motion.div>

          <OrganicTierCollaborationScene className="origin-center scale-[1.06]" />
        </div>
      </section>
    </div>
  );
}

export default MainHeroCollaborationDesignV2Page;
