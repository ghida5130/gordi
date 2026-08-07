import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate, Link } from "react-router-dom";
import { signup } from "@/api/auth";
import { useToast } from "@/hooks/useToast";
import { useUserStore } from "@/stores/useUserStore";
import { getApiErrorMessage } from "@/utils/apiError";
import { setAccessToken } from "@/utils/tokenStorage";

// 약관 및 정책 텍스트 정의
const TERMS_TEXT = `제1조 (목적)
본 약관은 서비스 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (회원의 의무)
① 회원은 가입 시 정확한 정보를 기재해야 합니다.
② 회원은 타인의 정보를 도용하여 가입할 수 없습니다.

제3조 (서비스의 제공)
회사는 회원에게 원활한 서비스를 제공하기 위해 최선을 다합니다.`;

const PRIVACY_TEXT = `1. 수집하는 개인정보 항목
- 필수항목: 이메일, 비밀번호, 닉네임
- 선택항목: 서비스 이용 기록

2. 개인정보의 수집 및 이용 목적
- 회원 가입 의사 확인, 회원제 서비스 제공에 따른 본인 식별 및 인증
- 서비스 부정이용 방지 및 비인가 사용 방지

3. 개인정보의 보유 및 이용 기간
- 원칙적으로 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다.`;

const MARKETING_TEXT = `1. 마케팅 및 광고에의 활용
- 신규 서비스(제품) 개발 및 맞춤 서비스 제공
- 이벤트 및 참여 기회 제공, 광고성 정보 제공

2. 수신 동의 거부
- 회원은 언제든지 마케팅 정보 수신 동의를 거부할 수 있으며, 거부 시에도 기본 서비스 이용에는 제한이 없습니다.`;

export default function SignupPage() {
    const navigate = useNavigate();
    const toast = useToast();
    const setUser = useUserStore((state) => state.setUser);

    // 폼 상태 관리
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [nickname, setNickname] = useState("");

    // 약관 동의 상태 관리
    const [agreements, setAgreements] = useState({
        terms: false,
        privacy: false,
        marketing: false,
    });

    // 팝업창(모달) 상태 관리
    const [modalContent, setModalContent] = useState(null);

    const openModal = (title, content) => {
        setModalContent({ title, content });
    };

    // 정규식 (유효성 검사)
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[!@#$%^&*?_]).{8,}$/;
    const nicknameRegex = /^[a-zA-Z가-힣0-9]{2,12}$/; // 특수문자 제외 2~12자

    // ⭐️ 수정됨: React-Query 회원가입 요청 (최신 API 명세서 반영)
    const { mutate, isPending } = useMutation({
        mutationFn: signup,
        onSuccess: (response, variables) => {
            const accessToken = response.data?.data?.accessToken || response.data?.accessToken;

            if (accessToken) {
                setAccessToken(accessToken);
                setUser({
                    email: variables.email,
                    nickname: variables.nickname,
                    profileImageUrl: null,
                });
            }

            navigate("/signup/complete", { replace: true });
        },
        onError: (error) => {
            toast.error(getApiErrorMessage(error, "회원가입에 실패했습니다. 입력 정보를 확인하고 다시 시도해 주세요."));
        },
    });

    // 전체 동의 핸들러
    const handleAllCheck = (e) => {
        const isChecked = e.target.checked;
        setAgreements({
            terms: isChecked,
            privacy: isChecked,
            marketing: isChecked,
        });
    };

    // 개별 동의 핸들러
    const handleSingleCheck = (e) => {
        const { name, checked } = e.target;
        setAgreements((prev) => ({ ...prev, [name]: checked }));
    };

    // 폼 제출 핸들러
    const handleSubmit = (e) => {
        e.preventDefault();

        if (!passwordRegex.test(password)) {
            toast.warning("비밀번호는 영문, 숫자, 특수문자 포함 8자리 이상이어야 합니다.");
            return;
        }
        if (password !== passwordConfirm) {
            toast.warning("비밀번호가 일치하지 않습니다.");
            return;
        }
        if (!nicknameRegex.test(nickname)) {
            toast.warning("닉네임은 특수문자를 제외한 2~12글자로 입력해주세요.");
            return;
        }
        if (!agreements.terms || !agreements.privacy) {
            toast.warning("필수 이용약관에 동의해주세요.");
            return;
        }

        // ⭐️ 수정됨: 백엔드 명세서에 맞게 3가지 데이터만 전송
        mutate({
            email,
            password,
            nickname,
        });
    };

    const isAllChecked = agreements.terms && agreements.privacy && agreements.marketing;

    return (
        <div className="relative flex min-h-[calc(100vh-6rem)] min-w-[1180px] items-center justify-center overflow-hidden px-12 py-14">

            <motion.main
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="relative grid w-[1100px] grid-cols-[340px_1fr] overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.12)]"
            >
                <section className="relative flex flex-col overflow-hidden bg-[#253129] p-10 text-white">
                    <div className="absolute -right-24 -top-20 h-64 w-64 rounded-full border border-white/10" />
                    <h1 className="relative text-[32px] font-semibold leading-[1.2] tracking-[-0.04em]">
                        간단한 정보로
                        <br />gordi를 시작해요.
                    </h1>
                    <p className="relative mt-4 text-sm leading-6 text-white/58">입력한 정보는 더 잘 맞는 추천과<br />안전한 서비스 제공에 사용돼요.</p>

                    <div className="relative mt-12 space-y-3">
                        {[
                            ["01", "계정 정보", "이메일과 닉네임 입력"],
                            ["02", "약관 확인", "필수 약관 동의"],
                            ["03", "가입 완료", "나만의 취향 설정 시작"],
                        ].map(([number, title, description], index) => (
                            <motion.div
                                key={number}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.22 + index * 0.08, duration: 0.42 }}
                                className={`flex gap-3 rounded-2xl border p-3.5 ${index === 0 ? "border-emerald-300/30 bg-emerald-300/10" : "border-white/10 bg-white/[0.05]"}`}
                            >
                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-black ${index === 0 ? "bg-emerald-200 text-[#253129]" : "bg-white/10 text-white/45"}`}>{number}</span>
                                <span>
                                    <strong className={`block text-xs font-semibold ${index === 0 ? "text-white" : "text-white/58"}`}>{title}</strong>
                                    <span className="mt-1 block text-[11px] text-white/38">{description}</span>
                                </span>
                            </motion.div>
                        ))}
                    </div>

                    <p className="relative mt-auto pt-12 text-[11px] leading-5 text-white/35">계정 정보는 보호되며<br />서비스 운영 목적으로만 사용됩니다.</p>
                </section>

                <section className="px-12 py-10">
                    <div className="mb-7 flex items-end justify-between">
                        <div>
                            <h2 className="text-[28px] font-semibold tracking-[-0.035em] text-slate-950">이메일로 시작하기</h2>
                        </div>
                        <Link to="/signup" className="text-xs font-semibold text-slate-400 transition-colors hover:text-slate-700">가입 방법 바꾸기</Link>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="rounded-[24px] border border-slate-200 bg-slate-50/65 p-5">
                            <div className="mb-4 flex items-center gap-2">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#253129] text-[10px] font-black text-white">01</span>
                                <h3 className="text-xs font-bold text-slate-700">계정 정보</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                                <div>
                                    <label className="mb-2 block text-xs font-semibold text-slate-600">이메일</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="user@example.com"
                                        required
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                                    />
                                    <p className="mt-1.5 text-[10px] text-slate-400">로그인에 사용됩니다</p>
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-semibold text-slate-600">닉네임</label>
                                    <input
                                        type="text"
                                        value={nickname}
                                        onChange={(e) => setNickname(e.target.value)}
                                        placeholder="앱에서 사용되는 이름"
                                        required
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                                    />
                                    <p className="mt-1.5 text-[10px] text-slate-400">2~12글자, 특수문자 제외</p>
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-semibold text-slate-600">비밀번호</label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                                    />
                                    <p className="mt-1.5 text-[10px] text-slate-400">영문+숫자+특수문자 8자리 이상</p>
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-semibold text-slate-600">비밀번호 확인</label>
                                    <input
                                        type="password"
                                        value={passwordConfirm}
                                        onChange={(e) => setPasswordConfirm(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                            <div className="mb-4 flex items-center gap-2">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-[10px] font-black text-violet-700">02</span>
                                <h3 className="text-xs font-bold text-slate-700">약관 동의</h3>
                            </div>

                            <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                                <input type="checkbox" checked={isAllChecked} onChange={handleAllCheck} className="h-4 w-4 accent-[#253129]" />
                                <span className="text-sm font-bold text-slate-800">전체 동의</span>
                                <span className="ml-auto text-[10px] text-slate-400">선택 항목 포함</span>
                            </label>

                            <div className="mt-3 space-y-1">
                                <label className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors hover:bg-slate-50">
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" name="terms" checked={agreements.terms} onChange={handleSingleCheck} className="h-4 w-4 accent-[#253129]" />
                                        <span className="text-slate-600">[필수] 이용약관</span>
                                    </div>
                                    <button type="button" onClick={() => openModal("이용약관", TERMS_TEXT)} className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800">보기</button>
                                </label>

                                <label className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors hover:bg-slate-50">
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" name="privacy" checked={agreements.privacy} onChange={handleSingleCheck} className="h-4 w-4 accent-[#253129]" />
                                        <span className="text-slate-600">[필수] 개인정보 처리방침</span>
                                    </div>
                                    <button type="button" onClick={() => openModal("개인정보 처리방침", PRIVACY_TEXT)} className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800">보기</button>
                                </label>

                                <label className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors hover:bg-slate-50">
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" name="marketing" checked={agreements.marketing} onChange={handleSingleCheck} className="h-4 w-4 accent-[#253129]" />
                                        <span className="text-slate-600">[선택] 마케팅 정보 수신 동의</span>
                                    </div>
                                    <button type="button" onClick={() => openModal("마케팅 정보 수신 동의", MARKETING_TEXT)} className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800">보기</button>
                                </label>
                            </div>
                        </div>

                        <motion.button
                            type="submit"
                            disabled={isPending}
                            whileHover={isPending ? undefined : { y: -2 }}
                            whileTap={isPending ? undefined : { scale: 0.985 }}
                            className="w-full rounded-2xl bg-[#253129] px-4 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,49,41,0.2)] transition-colors hover:bg-[#344239] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                        >
                            {isPending ? "처리 중..." : "회원가입 완료"}
                        </motion.button>
                    </form>

                    <div className="pt-5 text-center text-sm text-slate-500">
                        이미 계정이 있으신가요?{" "}
                        <Link to="/login" className="ml-1 font-bold text-emerald-700 transition-colors hover:text-emerald-900">로그인</Link>
                    </div>
                </section>
            </motion.main>

            {/* 팝업창(모달) */}
            <AnimatePresence>
                {modalContent && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex min-w-[900px] items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[3px]"
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 12, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                            transition={{ duration: 0.22 }}
                            className="w-[440px] rounded-[24px] border border-white/70 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.2)]"
                        >
                            <div className="mb-4 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-950">{modalContent.title}</h3>
                                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-600">GORDI</span>
                            </div>

                            <div className="h-52 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-600">{modalContent.content}</div>

                            <motion.button
                                type="button"
                                onClick={() => setModalContent(null)}
                                whileHover={{ y: -1 }}
                                whileTap={{ scale: 0.985 }}
                                className="mt-5 w-full rounded-2xl bg-[#253129] py-3 text-sm font-bold text-white transition-colors hover:bg-[#344239]"
                            >
                                닫기
                            </motion.button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
