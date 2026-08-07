import { motion } from "motion/react";
import { Link } from "react-router-dom";

const easeOut = [0.16, 1, 0.3, 1];

const tierLayers = [
  {
    tier: "S",
    color: "bg-[#F6DCA5]",
    top: 40,
    delay: 0.24,
    hover: "group-hover:translate-x-1",
  },
  {
    tier: "A",
    color: "bg-[#CFE2CE]",
    top: 154,
    delay: 0.32,
    hover: "group-hover:translate-x-2",
  },
  {
    tier: "B",
    color: "bg-[#D9E0CD]",
    top: 268,
    delay: 0.4,
    hover: "group-hover:translate-x-3",
  },
  {
    tier: "C",
    color: "bg-[#DCDDD9]",
    top: 382,
    delay: 0.48,
    hover: "group-hover:translate-x-4",
  },
];

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

function MainHeroDesignPage() {
  return (
    <div className="min-h-[calc(100vh-6rem)] min-w-[1180px] overflow-hidden bg-[#F3F3EF] font-sans text-[#202421]">
      <section className="relative flex min-h-[720px] items-center justify-center px-12 py-16">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-55"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(31,35,32,0.08) 1px, transparent 0)",
            backgroundSize: "24px 24px",
            maskImage:
              "linear-gradient(to bottom, transparent, black 20%, black 76%, transparent)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 h-[620px] w-[920px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/75 blur-3xl"
        />

        <motion.div
          initial={{ opacity: 0, y: 26, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.82, ease: easeOut }}
          className="group relative h-[570px] w-[1040px]"
        >
          {tierLayers.map(({ tier, color, top, delay, hover }) => (
            <motion.div
              key={tier}
              initial={{ opacity: 0, x: -38 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.74, delay, ease: easeOut }}
              className={`absolute left-[128px] z-0 flex h-[104px] w-[850px] items-center justify-end rounded-r-[38px] pr-5 transition-transform duration-500 ease-out ${color} ${hover}`}
              style={{ top }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/35 bg-white/55 text-sm font-black text-[#4B504C] shadow-sm">
                {tier}
              </span>
            </motion.div>
          ))}

          <motion.article
            whileHover={{ x: -6, y: -4, rotate: -0.2 }}
            transition={{ duration: 0.42, ease: easeOut }}
            className="absolute left-[54px] top-5 z-10 flex h-[520px] w-[830px] flex-col justify-center overflow-hidden rounded-[48px] border-[8px] border-white bg-[linear-gradient(135deg,#ffffff_0%,#fbfbf8_58%,#f3f0ff_100%)] px-[72px] shadow-[0_36px_90px_rgba(31,35,32,0.2)]"
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-35"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(31,35,32,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(31,35,32,0.045) 1px, transparent 1px)",
                backgroundSize: "38px 38px",
                maskImage:
                  "linear-gradient(120deg, transparent 12%, black 65%, transparent)",
              }}
            />
            <div
              aria-hidden="true"
              className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#D9CDF8]/35 blur-3xl"
            />

            <div className="relative z-10">
              <motion.h1
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16, duration: 0.72, ease: easeOut }}
                className="text-[62px] font-semibold leading-[1.06] tracking-[-0.055em]"
              >
                나만의{" "}
                <Highlight color="bg-[#D9CDF8]" delay={0.48}>
                  아바타
                </Highlight>
                로
                <br />
                친구들과{" "}
                <Highlight color="bg-[#BFE7D2]" delay={0.62}>
                  함께
                </Highlight>
                <br />
                의상{" "}
                <Highlight color="bg-[#F8D4BF]" delay={0.76}>
                  티어메이커
                </Highlight>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.42, duration: 0.64, ease: easeOut }}
                className="mt-6 max-w-[590px] text-[16px] font-medium leading-7 text-[#666D67]"
              >
                내 체형에 맞는 옷을 AI로 추천받고 <br />
                친구들과 티어를 나누며 <br />
                가장 마음에 드는 코디를 완성해보세요.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.56, duration: 0.6, ease: easeOut }}
                className="mt-8"
              >
                <Link
                  to="/rooms"
                  className="group/button inline-flex h-[56px] items-center gap-7 rounded-full bg-[#242925] px-7 text-[15px] font-semibold text-white shadow-[0_18px_38px_rgba(31,35,32,0.18)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_23px_44px_rgba(31,35,32,0.24)]"
                >
                  지금 시작하기
                  <span
                    aria-hidden="true"
                    className="text-xl transition-transform duration-300 group-hover/button:translate-x-1.5"
                  >
                    →
                  </span>
                </Link>
              </motion.div>
            </div>
          </motion.article>
        </motion.div>
      </section>
    </div>
  );
}

export default MainHeroDesignPage;
