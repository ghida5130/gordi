import { useState } from "react";
import { motion } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import OrganicTierCollaborationScene from "@/components/main/OrganicTierCollaborationScene";
import { useUserStore } from "@/stores/useUserStore";
import { getAccessToken } from "@/utils/tokenStorage";

const easeOut = [0.16, 1, 0.3, 1];

const revealVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.68, ease: easeOut },
  },
};

const staggerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.08 } },
};

const featureCards = [
  {
    number: "01",
    label: "AVATAR",
    title: "내 체형 맞춤 아바타",
    description:
      "성별과 키, 몸무게를 입력하면 내 체형에 가까운 아바타를 만들 수 있어요.",
    color: "bg-[#BFE7D2]",
    line: "bg-emerald-300",
  },
  {
    number: "02",
    label: "CURATION",
    title: "AI가 골라주는 옷",
    description:
      "내 체형과 스타일 취향을 분석해 어울리는 옷을 한눈에 추천해드려요.",
    color: "bg-[#D9CDF8]",
    line: "bg-violet-300",
  },
  {
    number: "03",
    label: "TOGETHER",
    title: "친구들과 티어 매기기",
    description: "친구를 초대해 추천 의상을 S/A/B/C 티어로 함께 평가해보세요.",
    color: "bg-[#C9DFED]",
    line: "bg-sky-300",
  },
  {
    number: "04",
    label: "TRY ON",
    title: "아바타에 직접 입혀보기",
    description:
      "함께 고른 옷을 아바타에 입혀보며 나만의 최종 코디를 완성해보세요.",
    color: "bg-[#F8D4BF]",
    line: "bg-orange-300",
  },
];

const steps = [
  {
    number: "01",
    badge: "체형 분석",
    title: "체형 정보 입력",
    description: "성별과 키, 몸무게를 입력해 내 체형의 기준을 설정해요.",
    accent: "text-emerald-300",
    border: "group-hover:border-emerald-300/70",
  },
  {
    number: "02",
    badge: "아바타 프리셋",
    title: "아바타 생성",
    description: "입력한 정보에 가까운 아바타를 골라 내 모습으로 확정해요.",
    accent: "text-violet-300",
    border: "group-hover:border-violet-300/70",
  },
  {
    number: "03",
    badge: "AI 큐레이션",
    title: "AI 의상 추천",
    description: "AI가 체형과 취향을 분석해 어울리는 의상을 추천해드려요.",
    accent: "text-sky-300",
    border: "group-hover:border-sky-300/70",
  },
  {
    number: "04",
    badge: "실시간 협업",
    title: "친구와 코디 완성",
    description: "친구들과 티어를 정하고 가상 피팅으로 최종 코디를 확인해요.",
    accent: "text-orange-300",
    border: "group-hover:border-orange-300/70",
  },
];

const MainPage = () => {
  const navigate = useNavigate();
  const { isLogin } = useUserStore();
  const isLoggedIn = isLogin || !!getAccessToken();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen min-w-[1180px] overflow-x-hidden bg-[#F3F3EF] font-sans text-[#1F2320]">
      {/* 1. Hero Section */}
      <section className="relative flex h-screen min-h-[780px] w-full items-center overflow-hidden px-[clamp(32px,4vw,72px)] pb-12 pt-[120px]">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(31,35,32,0.08) 1px, transparent 0)",
            backgroundSize: "24px 24px",
            maskImage:
              "linear-gradient(to right, black, transparent 45%, transparent)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute -left-40 top-1/2 h-[560px] w-[560px] -translate-y-1/2 rounded-full bg-white/70 blur-3xl"
        />

        <div className="relative mx-auto grid w-full max-w-[1480px] grid-cols-[minmax(460px,500px)_minmax(0,1fr)] items-center gap-[clamp(28px,3vw,60px)] px-20">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerVariants}
            className="relative z-20 flex flex-col items-start"
          >
            <motion.h1
              variants={revealVariants}
              className="text-[clamp(58px,4.2vw,68px)] font-thin leading-[1.06] tracking-[-0.055em] text-[#202421]"
            >
              나만의{" "}
              <span className="relative isolate inline-block px-1 font-extrabold">
                아바타
                <motion.span
                  aria-hidden="true"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.55, duration: 0.7, ease: easeOut }}
                  className="absolute inset-x-0 bottom-[0.08em] -z-10 h-[0.24em] origin-left rounded-full bg-[#D9CDF8]"
                />
              </span>
              로
              <br />
              친구들과{" "}
              <span className="relative isolate inline-block px-1 font-extrabold">
                함께
                <motion.span
                  aria-hidden="true"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.68, duration: 0.7, ease: easeOut }}
                  className="absolute inset-x-0 bottom-[0.08em] -z-10 h-[0.24em] origin-left rounded-full bg-[#BFE7D2]"
                />
              </span>
              <br />
              의상{" "}
              <span className="relative isolate inline-block px-1 font-extrabold">
                티어메이커
                <motion.span
                  aria-hidden="true"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.81, duration: 0.8, ease: easeOut }}
                  className="absolute inset-x-0 bottom-[0.08em] -z-10 h-[0.24em] origin-left rounded-full bg-[#F8D4BF]"
                />
              </span>
            </motion.h1>

            <motion.p
              variants={revealVariants}
              className="mt-7 max-w-[500px] text-[17px] font-medium leading-8 text-[#646B65]"
            >
              내 체형에 맞는 옷을 AI로 추천받고, 친구들과 티어를 나누며 가장
              마음에 드는 코디를 완성해보세요.
            </motion.p>

            <motion.div
              variants={revealVariants}
              className="mt-10 flex items-center gap-5"
            >
              <motion.div
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2, ease: easeOut }}
              >
                <Link
                  to="/rooms"
                  className="group flex h-[58px] items-center gap-6 rounded-full bg-[#242925] px-7 text-[16px] font-semibold text-white shadow-[0_18px_38px_rgba(31,35,32,0.18)] transition-shadow duration-300 hover:shadow-[0_22px_42px_rgba(31,35,32,0.25)]"
                >
                  지금 시작하기
                  <span className="text-xl transition-transform duration-300 group-hover:translate-x-1.5">
                    →
                  </span>
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>

          <div className="flex h-[540px] min-w-0 items-center justify-center overflow-visible">
            <OrganicTierCollaborationScene className="origin-center scale-[0.75] min-[1200px]:scale-[0.79] min-[1360px]:scale-[0.92] min-[1536px]:scale-[1.02] min-[1720px]:scale-[1.1]" />
          </div>
        </div>
      </section>

      {/* 2. Features Section */}
      <section className="w-full px-[clamp(32px,4vw,72px)] py-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerVariants}
          className="mx-auto w-full max-w-[1340px] rounded-[44px] border border-[#DEE0DB] bg-[#FAFAF7] px-14 py-16 shadow-[0_24px_70px_rgba(31,35,32,0.07)]"
        >
          <motion.div
            variants={revealVariants}
            className="mb-12 flex items-end justify-between"
          >
            <div>
              <h2 className="text-[42px] font-semibold leading-[1.12] tracking-[-0.045em]">
                옷을 고르는 모든 순간을
                <br />더 즐겁게
              </h2>
            </div>
            <p className="mb-1 w-[390px] text-[15px] font-medium leading-7 text-[#707771]">
              혼자 고민하던 의상 선택을 아바타와 AI, 친구들의 의견으로 더 쉽고
              분명하게 만들어보세요.
            </p>
          </motion.div>

          <div className="grid grid-cols-4 gap-5">
            {featureCards.map((feature) => (
              <motion.article
                key={feature.number}
                variants={revealVariants}
                whileHover={{ y: -6 }}
                transition={{ duration: 0.28, ease: easeOut }}
                className="group relative min-h-[286px] overflow-hidden rounded-[28px] border border-[#E2E4DF] bg-white p-7 shadow-[0_10px_28px_rgba(31,35,32,0.04)] transition-shadow duration-300 hover:shadow-[0_20px_40px_rgba(31,35,32,0.1)]"
              >
                <div className="mb-12 flex items-center justify-between">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-[15px] text-[13px] font-black text-[#343A35] ${feature.color}`}
                  >
                    {feature.number}
                  </span>
                </div>
                <h3 className="text-[19px] font-bold tracking-[-0.025em] text-[#292E2A]">
                  {feature.title}
                </h3>
                <p className="mt-4 text-[14px] font-medium leading-6 text-[#747A74]">
                  {feature.description}
                </p>
                <div
                  className={`absolute bottom-0 left-0 h-1 w-0 rounded-r-full ${feature.line} transition-all duration-500 ease-out group-hover:w-full`}
                />
              </motion.article>
            ))}
          </div>
        </motion.div>
      </section>

      {/* 3. Steps Section */}
      <section className="w-full px-[clamp(32px,4vw,72px)] pb-12 pt-8 text-white">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.18 }}
          variants={staggerVariants}
          className="mx-auto w-full max-w-[1340px] overflow-hidden rounded-[44px] bg-[#202421] px-14 py-16 shadow-[0_30px_80px_rgba(20,24,21,0.2)]"
        >
          <motion.div
            variants={revealVariants}
            className="mb-14 flex items-end justify-between"
          >
            <div>
              <h2 className="text-[42px] font-semibold leading-[1.12] tracking-[-0.045em]">
                단 4단계로
                <br />내 코디를 완성해요
              </h2>
            </div>
            <p className="mb-1 w-[360px] text-[15px] font-medium leading-7 text-white/55">
              체형 설정부터 친구들과 함께하는 최종 선택까지, 하나의 흐름으로
              자연스럽게 이어집니다.
            </p>
          </motion.div>

          <div className="grid grid-cols-4 gap-4">
            {steps.map((step) => (
              <motion.article
                key={step.number}
                variants={revealVariants}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.26, ease: easeOut }}
                className={`group min-h-[260px] rounded-[26px] border border-white/10 bg-white/[0.045] p-7 transition-colors duration-300 ${step.border}`}
              >
                <div className="mb-11 flex items-start justify-between">
                  <span
                    className={`text-[34px] font-light tracking-[-0.04em] ${step.accent}`}
                  >
                    {step.number}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold tracking-[0.06em] text-white/55">
                    {step.badge}
                  </span>
                </div>
                <h3 className="text-[18px] font-bold tracking-[-0.02em]">
                  {step.title}
                </h3>
                <p className="mt-4 text-[13px] font-medium leading-6 text-white/48">
                  {step.description}
                </p>
              </motion.article>
            ))}
          </div>

          <motion.div
            variants={revealVariants}
            className="mt-10 flex items-center justify-between border-t border-white/10 pt-7 text-[12px] font-semibold text-white/45"
          >
            <span>GORDI · FIND YOUR BEST FIT</span>
            <span>AI 추천부터 함께하는 선택까지</span>
          </motion.div>
        </motion.div>
      </section>

      {/* 4. Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/40 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => setIsModalOpen(false)}
          ></div>

          <div className="relative bg-white rounded-3xl p-10 w-full max-w-sm flex flex-col items-center text-center shadow-2xl z-10">
            <div className="w-12 h-12 bg-black text-white rounded-xl flex justify-center items-center mb-6">
              👥
            </div>
            <h3 className="text-2xl font-bold mb-2">티어메이커 시작하기</h3>
            <p className="text-gray-500 text-sm mb-8">
              친구들과 함께 의상을 골라보세요.
              <br />
              투표로 최고의 아이템을 확정하세요.
            </p>

            <button
              onClick={() => {
                setIsModalOpen(false);
                navigate(isLoggedIn ? "/rooms/create" : "/login");
              }}
              className="w-full bg-[#1a1a1a] text-white py-4 rounded-xl font-medium mb-3 hover:bg-black transition-colors"
            >
              새 방 만들기 →
            </button>
            <button
              onClick={() => {
                setIsModalOpen(false);
                navigate("/rooms");
              }}
              className="w-full bg-gray-100 text-gray-800 py-4 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              초대 코드로 입장
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainPage;
