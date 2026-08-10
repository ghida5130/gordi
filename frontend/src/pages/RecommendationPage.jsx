import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router-dom";

import {
  createRecommendation,
  getRecommendationOptions,
  replaceRecommendationItems,
} from "@/api/recommendations";
import { createRoom } from "@/api/rooms";
import { getMyAvatar } from "@/api/users";
import arrowImage from "@/assets/images/arrow.svg";
import AvatarSetupPrompt from "@/components/common/AvatarSetupPrompt";
import PriceRangeSlider, {
  PRICE_INPUT_MAX,
  PRICE_SLIDER_MAX,
} from "@/components/common/PriceRangeSlider";
import { getApiErrorMessage } from "@/utils/apiError";
import { setRoomSession } from "@/utils/roomSessionStorage";

const unwrap = (response) => {
  let payload = response;

  while (
    payload?.data &&
    typeof payload.data === "object" &&
    !Array.isArray(payload.data)
  ) {
    payload = payload.data;
  }

  return payload ?? {};
};
const toArray = (value) => (Array.isArray(value) ? value : []);
const RECOMMENDATION_CATEGORY_CODES = new Set(["TOP", "BOTTOM"]);
const createIdempotencyKey = () => crypto.randomUUID();
const getReplaceErrorMessage = (error) =>
  error?.response?.status === 409
    ? "추천 결과가 변경되었습니다. 최신 결과를 다시 확인해 주세요."
    : getApiErrorMessage(error, "선택한 의상을 다시 추천하지 못했습니다.");
const getRecommendationErrorMessage = (error) => {
  if (error?.response?.status === 403)
    return "이 추천 결과를 조회할 권한이 없습니다.";
  if (error?.response?.status === 404) return "추천 결과를 찾을 수 없습니다.";
  return getApiErrorMessage(error, "추천 결과를 불러오지 못했습니다.");
};

function RecommendationPage() {
  const navigate = useNavigate();
  const roomIdempotencyKey = useRef(crypto.randomUUID());
  const [step, setStep] = useState("form");
  const [recommendation, setRecommendation] = useState(null);
  const [submittedConditions, setSubmittedConditions] = useState(null);
  const [submittedRecommendation, setSubmittedRecommendation] = useState(null);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [replacingProductIds, setReplacingProductIds] = useState([]);
  const [replacementNotice, setReplacementNotice] = useState("");
  const [form, setForm] = useState({
    category: "",
    subcategory: "",
    minPrice: "",
    maxPrice: "",
    moodCodes: [],
    additionalInfo: "",
  });
  const avatarQuery = useQuery({
    queryKey: ["myAvatar"],
    queryFn: getMyAvatar,
    retry: false,
    refetchOnMount: "always",
  });
  const optionsQuery = useQuery({
    queryKey: ["recommendation-options"],
    queryFn: getRecommendationOptions,
    enabled: avatarQuery.isSuccess,
  });
  const options = unwrap(optionsQuery.data);
  const categories = toArray(options.categories).filter((category) =>
    RECOMMENDATION_CATEGORY_CODES.has(category?.code),
  );
  const moods = toArray(options.moods);
  const budgetPolicy = options.budgetPolicy ?? {};
  const budgetMinAllowed = Number(budgetPolicy.minAllowed ?? 0);
  const selectedFormCategory =
    categories.find((category) => category.code === form.category) ??
    categories[0];
  const recommendationForm = {
    ...form,
    category: selectedFormCategory?.code ?? form.category,
    subcategory:
      form.subcategory || selectedFormCategory?.subcategories?.[0]?.code || "",
    minPrice: form.minPrice || String(budgetMinAllowed),
    maxPrice: form.maxPrice || String(PRICE_SLIDER_MAX),
  };

  const createMutation = useMutation({
    mutationFn: createRecommendation,
    onSuccess: (response) => {
      setRecommendation(unwrap(response));
    },
  });
  const recommendationId =
    recommendation?.recommendationId ?? recommendation?.id;
  const recommendationResult = recommendation;

  const recommendedItems = useMemo(
    () =>
      toArray(
        recommendationResult?.items ??
          recommendationResult?.recommendedItems ??
          recommendationResult?.products,
      ),
    [recommendationResult],
  );
  const replaceMutation = useMutation({
    mutationFn: replaceRecommendationItems,
    onSuccess: (response) => {
      const replacementResult = unwrap(response);
      const replacements = toArray(replacementResult.replaced);

      setRecommendation((currentRecommendation) => {
        if (!currentRecommendation) return currentRecommendation;

        const currentItems = toArray(
          currentRecommendation.items ??
            currentRecommendation.recommendedItems ??
            currentRecommendation.products,
        );
        const responseItems = toArray(replacementResult.items);
        const nextItems = currentItems.map((item) => {
          const productId = item.productId ?? item.id;
          const replacement = replacements.find(
            (currentReplacement) =>
              String(currentReplacement.oldProductId) === String(productId),
          );

          if (!replacement) return item;

          return (
            responseItems.find(
              (responseItem) =>
                String(responseItem.productId ?? responseItem.id) ===
                String(replacement.newProductId),
            ) ?? {
              ...replacement,
              productId: replacement.newProductId,
              rank: replacement.position ?? item.rank,
            }
          );
        });

        return {
          ...currentRecommendation,
          ...replacementResult,
          items: nextItems,
        };
      });
      setSelectedProductIds([]);

      const unreplacedCount = toArray(
        replacementResult.unreplacedProductIds,
      ).length;
      setReplacementNotice(
        unreplacedCount > 0
          ? `${unreplacedCount}개 항목은 대체할 상품을 찾지 못했습니다.`
          : "선택한 항목을 새로운 추천으로 교체했습니다.",
      );
    },
    onSettled: () => {
      setReplacingProductIds([]);
    },
  });
  const createRoomMutation = useMutation({
    mutationFn: (roomInformation) =>
      createRoom(roomInformation, roomIdempotencyKey.current),
    onSuccess: (response) => {
      setRoomSession({
        ...response.data,
        role: "HOST",
        nickname: "방장",
      });
      navigate(`/rooms/${response.data.roomId}`, { replace: true });
    },
  });

  useEffect(() => {
    roomIdempotencyKey.current = crypto.randomUUID();
  }, [recommendationId, recommendationResult?.version]);

  const toggleMood = (moodCode) =>
    setForm((current) => {
      const isSelected = current.moodCodes.includes(moodCode);

      if (!isSelected && current.moodCodes.length >= 2) return current;

      return {
        ...current,
        moodCodes: isSelected
          ? current.moodCodes.filter((item) => item !== moodCode)
          : [...current.moodCodes, moodCode],
      };
    });
  const setCategory = (categoryCode) => {
    const category = categories.find((item) => item.code === categoryCode);
    setForm((current) => ({
      ...current,
      category: categoryCode,
      subcategory: category?.subcategories?.[0]?.code || "",
    }));
  };
  const handleSubmit = (event) => {
    event.preventDefault();

    if (recommendationForm.moodCodes.length === 0) return;

    const selectedCategory = categories.find(
      (category) => category.code === recommendationForm.category,
    );
    const selectedSubcategory = selectedCategory?.subcategories?.find(
      (subcategory) => subcategory.code === recommendationForm.subcategory,
    );
    setSubmittedConditions({
      category: selectedCategory?.label ?? recommendationForm.category,
      subcategory: selectedSubcategory?.label ?? recommendationForm.subcategory,
      moods: moods
        .filter((mood) => recommendationForm.moodCodes.includes(mood.code))
        .map((mood) => mood.label),
      budgetMin: Number(recommendationForm.minPrice),
      budgetMax: Number(recommendationForm.maxPrice),
      additionalInfo: recommendationForm.additionalInfo.trim(),
    });
    setSubmittedRecommendation({
      category: recommendationForm.category,
      subcategory: recommendationForm.subcategory,
      budgetMin: Number(recommendationForm.minPrice),
      budgetMax: Number(recommendationForm.maxPrice),
      moods: recommendationForm.moodCodes,
      tpo: recommendationForm.additionalInfo.trim(),
    });
    setRecommendation(null);
    createMutation.reset();
    replaceMutation.reset();
    createRoomMutation.reset();
    setSelectedProductIds([]);
    setReplacingProductIds([]);
    setReplacementNotice("");
    setStep("analysis");
  };
  const handleRecommend = () => {
    if (!submittedRecommendation || createMutation.isPending) return;

    setRecommendation(null);
    setSelectedProductIds([]);
    setReplacingProductIds([]);
    setReplacementNotice("");
    setStep("results");
    createMutation.mutate({
      recommendation: submittedRecommendation,
      idempotencyKey: createIdempotencyKey(),
    });
  };
  const toggleSelectedProduct = (productId) => {
    setSelectedProductIds((currentProductIds) =>
      currentProductIds.includes(productId)
        ? currentProductIds.filter((currentId) => currentId !== productId)
        : [...currentProductIds, productId],
    );
  };
  const requestReplacement = (productIds) => {
    if (
      !recommendationId ||
      !recommendationResult?.version ||
      productIds.length === 0 ||
      replaceMutation.isPending
    ) {
      return;
    }

    setReplacementNotice("");
    createRoomMutation.reset();
    const targetProductIds = [...productIds];
    setReplacingProductIds(targetProductIds);
    replaceMutation.mutate({
      recommendationId,
      baseVersion: recommendationResult?.version,
      productIds: targetProductIds.map(Number),
      idempotencyKey: createIdempotencyKey(),
    });
  };
  const handleReplaceSelected = () => {
    requestReplacement(selectedProductIds);
  };
  const handleReplaceAll = () => {
    const allProductIds = recommendedItems
      .map((item) => item.productId ?? item.id)
      .filter((productId) => productId != null);

    requestReplacement(allProductIds);
  };
  const handleCreateRoom = () => {
    if (
      !recommendationId ||
      !recommendationResult?.version ||
      createRoomMutation.isPending
    ) {
      return;
    }

    replaceMutation.reset();
    createRoomMutation.mutate({
      recommendationId: Number(recommendationId),
      recommendationVersion: Number(recommendationResult.version),
      maxParticipants: 4,
    });
  };

  if (avatarQuery.isPending || avatarQuery.isFetching) {
    return (
      <main className="min-h-[calc(100vh-6rem)] px-4 py-10 sm:py-16">
        <div className="mx-auto h-72 max-w-xl animate-pulse rounded-[24px] border border-[#E1E3DE] bg-white shadow-[0_20px_55px_rgba(31,35,32,0.07)]" />
      </main>
    );
  }

  if (avatarQuery.isError) {
    if (avatarQuery.error.response?.status === 404) {
      return (
        <main className="min-h-[calc(100vh-6rem)] px-4 py-10 sm:py-16">
          <AvatarSetupPrompt />
        </main>
      );
    }

    return (
      <main className="min-h-[calc(100vh-6rem)] px-4 py-10 sm:py-16">
        <p className="mx-auto max-w-xl rounded-[24px] border border-red-100 bg-red-50 p-5 text-sm font-medium text-red-700 shadow-sm">
          {getApiErrorMessage(
            avatarQuery.error,
            "아바타 정보를 불러오지 못했습니다.",
          )}
        </p>
      </main>
    );
  }

  if (step === "results")
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <RecommendationResults
          items={recommendedItems}
          emptyReason={recommendationResult?.emptyReason}
          isPending={
            createMutation.isPending ||
            (!recommendationResult && !createMutation.isError)
          }
          isReplacing={replaceMutation.isPending}
          isCreatingRoom={createRoomMutation.isPending}
          error={createMutation.error}
          actionError={
            replaceMutation.isError
              ? getReplaceErrorMessage(replaceMutation.error)
              : createRoomMutation.isError
                ? getApiErrorMessage(
                    createRoomMutation.error,
                    "티어메이커 방을 만들지 못했습니다.",
                  )
                : ""
          }
          replacementNotice={replacementNotice}
          selectedProductIds={selectedProductIds}
          replacingProductIds={replacingProductIds}
          canRequestActions={Boolean(
            recommendationId && recommendationResult?.version,
          )}
          onBack={() => setStep("analysis")}
          onToggleProduct={toggleSelectedProduct}
          onReplaceSelected={handleReplaceSelected}
          onReplaceAll={handleReplaceAll}
          onCreateRoom={handleCreateRoom}
        />
      </motion.div>
    );

  return (
    <main className="min-h-[calc(100vh-6rem)] px-4 py-10 text-[#242925] sm:py-16">
      <section className="mx-auto max-w-xl">
        <header className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-[28px] font-bold tracking-[-0.035em]">
              {step === "form" ? "의상 추천받기" : "추천 조건 확인"}
            </h1>
            <p className="mt-2 text-sm font-medium text-[#848A84]">
              {step === "form"
                ? "추천을 위한 사용자 정보 입력"
                : "입력하신 조건을 확인해 주세요."}
            </p>
          </div>
          <div className="flex items-center rounded-full border border-[#DADDD7] bg-white p-1 shadow-sm">
            <span
              className={`rounded-full px-3 py-2 text-[11px] font-bold transition-colors duration-300 ${step === "form" ? "bg-[#242925] text-white" : "text-[#858B85]"}`}
            >
              01 조건 입력
            </span>
            <span
              className={`rounded-full px-3 py-2 text-[11px] font-bold transition-colors duration-300 ${step === "analysis" ? "bg-[#242925] text-white" : "text-[#858B85]"}`}
            >
              02 확인
            </span>
          </div>
        </header>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
          >
            {step === "form" ? (
              <RecommendationForm
                form={recommendationForm}
                categories={categories}
                moods={moods}
                budgetPolicy={budgetPolicy}
                optionsQuery={optionsQuery}
                onChange={setForm}
                onCategory={setCategory}
                onMood={toggleMood}
                onSubmit={handleSubmit}
              />
            ) : (
              <AnalysisCard
                fallbackConditions={submittedConditions}
                onRetry={() => setStep("form")}
                onResults={handleRecommend}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </section>
    </main>
  );
}

function RecommendationForm({
  form,
  categories,
  moods,
  budgetPolicy,
  optionsQuery,
  onChange,
  onCategory,
  onMood,
  onSubmit,
}) {
  const inputClass =
    "mt-2 w-full rounded-[14px] border border-[#DDE0DA] bg-[#F7F7F4] px-4 py-3 text-sm text-[#2D322E] outline-none transition duration-200 placeholder:text-[#A3A8A3] focus:border-[#8D7BE8] focus:bg-white focus:ring-4 focus:ring-[#D9CDF8]/45";
  const selectClass = `${inputClass.replace("mt-2 ", "")} appearance-none pr-11`;
  if (optionsQuery.isPending)
    return (
      <div className="rounded-[24px] border border-[#E0E2DD] bg-white p-8 text-center text-sm font-medium text-[#818781] shadow-[0_16px_42px_rgba(31,35,32,0.06)]">
        <span className="mx-auto mb-4 block size-7 animate-spin rounded-full border-[3px] border-[#E7E4F6] border-t-[#6D5CCF]" />
        추천 옵션을 불러오는 중입니다.
      </div>
    );
  if (optionsQuery.isError)
    return (
      <p className="rounded-[24px] border border-red-100 bg-red-50 p-5 text-sm font-medium text-red-700">
        {getApiErrorMessage(
          optionsQuery.error,
          "추천 옵션을 불러오지 못했습니다.",
        )}
      </p>
    );
  if (categories.length === 0)
    return (
      <p className="rounded-[24px] border border-amber-100 bg-amber-50 p-5 text-sm font-medium text-amber-800">
        선택할 수 있는 상의 또는 하의 카테고리가 없습니다.
      </p>
    );

  const selectedCategory = categories.find(
    (category) => category.code === form.category,
  );
  const subcategories = selectedCategory?.subcategories ?? [];

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-[24px] border border-[#E0E2DD] bg-white p-6 shadow-[0_16px_42px_rgba(31,35,32,0.06)]">
        <div className="mb-6 flex items-center justify-between border-b border-[#ECEDE9] pb-4">
          <div>
            <p className="text-sm font-bold text-[#2B302C]">추천 조건</p>
            <p className="mt-1 text-xs font-medium text-[#929791]">
              원하는 의상과 예산을 알려주세요.
            </p>
          </div>
          <span className="flex size-9 items-center justify-center rounded-[12px] bg-[#D9CDF8] text-xs font-black text-[#4D437A]">
            01
          </span>
        </div>
        <label className="block text-sm font-semibold text-[#444A45]">
          카테고리
          <div className="relative mt-2">
            <select
              value={form.category}
              onChange={(event) => onCategory(event.target.value)}
              className={selectClass}
            >
              {categories.map((category) => (
                <option key={category.code} value={category.code}>
                  {category.label}
                </option>
              ))}
            </select>
            <img
              src={arrowImage}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-1/2 size-3 -translate-y-1/2 object-contain opacity-45"
            />
          </div>
        </label>
        <label className="mt-5 block text-sm font-semibold text-[#444A45]">
          세부 분류
          <div className="relative mt-2">
            <select
              value={form.subcategory}
              onChange={(event) =>
                onChange({ ...form, subcategory: event.target.value })
              }
              className={selectClass}
            >
              {subcategories.map((subcategory) => (
                <option key={subcategory.code} value={subcategory.code}>
                  {subcategory.label}
                </option>
              ))}
            </select>
            <img
              src={arrowImage}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-1/2 size-3 -translate-y-1/2 object-contain opacity-45"
            />
          </div>
        </label>
        <PriceRangeSlider
          min={budgetPolicy.minAllowed ?? 0}
          sliderMax={PRICE_SLIDER_MAX}
          inputMax={PRICE_INPUT_MAX}
          minValue={form.minPrice}
          maxValue={form.maxPrice}
          label="예산"
          className="mt-6"
          onChange={({ minValue, maxValue }) =>
            onChange({
              ...form,
              minPrice: String(minValue),
              maxPrice: String(maxValue),
            })
          }
        />
        <p className="mt-6 text-sm font-semibold text-[#444A45]">
          선호 무드
          <span className="ml-2 text-xs font-medium text-[#A0A59F]">
            (최대 2개 선택 가능)
          </span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {moods.map((mood) => (
            <Tag
              key={mood.code}
              active={form.moodCodes.includes(mood.code)}
              onClick={() => onMood(mood.code)}
            >
              {mood.label}
            </Tag>
          ))}
        </div>
      </div>
      <section className="rounded-[24px] border border-[#E0E2DD] bg-white p-6 shadow-[0_14px_36px_rgba(31,35,32,0.05)]">
        <label className="block text-sm font-semibold text-[#444A45]">
          <span className="flex items-center gap-2">
            TPO 입력
            <span className="rounded-full bg-[#F0EDF9] px-2 py-0.5 text-[10px] font-bold text-[#6D5CCF]">
              선택
            </span>
          </span>
          <textarea
            value={form.additionalInfo}
            maxLength="300"
            onChange={(event) =>
              onChange({ ...form, additionalInfo: event.target.value })
            }
            placeholder="예) 다음 주 토요일 친구 생일파티, 실내 레스토랑, 격식 있으면서도 가볍게 입고 싶어요."
            className={`${inputClass} min-h-28 resize-none`}
          />
        </label>
        <p className="mt-2 text-right text-xs font-medium text-[#979C97]">
          {form.additionalInfo.length} / 300자
        </p>
      </section>
      <button
        disabled={
          !form.category ||
          !form.subcategory ||
          !form.minPrice ||
          !form.maxPrice ||
          form.moodCodes.length === 0
        }
        className="w-full rounded-full bg-[#242925] py-4 font-bold text-white shadow-[0_14px_28px_rgba(31,35,32,0.15)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#171B18] hover:shadow-[0_18px_34px_rgba(31,35,32,0.22)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
      >
        입력 완료
      </button>
    </form>
  );
}

function AnalysisCard({ fallbackConditions, onRetry, onResults }) {
  const conditions = fallbackConditions ?? {};
  return (
    <>
      <div className="rounded-[24px] border border-[#E0E2DD] bg-white p-6 shadow-[0_16px_42px_rgba(31,35,32,0.06)]">
        <div className="flex items-center justify-between border-b border-[#ECEDE9] pb-4">
          <div>
            <p className="text-base font-bold text-[#2B302C]">
              이 조건으로 AI 추천을 시작합니다.
            </p>
          </div>
          <span className="flex size-9 items-center justify-center rounded-[12px] bg-[#D9CDF8] text-xs font-black text-[#4D437A]">
            02
          </span>
        </div>
        <dl className="mt-5 grid grid-cols-[90px_1fr] gap-y-4 rounded-[18px] bg-[#F7F7F4] p-5 text-sm">
          <dt className="font-medium text-[#90968F]">카테고리</dt>
          <dd className="font-semibold text-[#353A36]">
            {[conditions.category, conditions.subcategory]
              .filter(Boolean)
              .join(" · ") || "입력한 조건"}
          </dd>
          <dt className="font-medium text-[#90968F]">무드</dt>
          <dd className="font-semibold text-[#353A36]">
            {conditions.moods?.join(", ") || "선택 안 함"}
          </dd>
          <dt className="font-medium text-[#90968F]">가격대</dt>
          <dd className="font-semibold text-[#353A36]">{`${Number(conditions.budgetMin ?? 0).toLocaleString()}원 ~ ${Number(conditions.budgetMax ?? 0).toLocaleString()}원`}</dd>
          {conditions.additionalInfo && (
            <>
              <dt className="font-medium text-[#90968F]">TPO</dt>
              <dd className="whitespace-pre-wrap font-semibold text-[#353A36]">
                {conditions.additionalInfo}
              </dd>
            </>
          )}
        </dl>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <button
          onClick={onRetry}
          className="rounded-full border border-[#DADDD7] bg-white px-3 py-4 text-sm font-bold text-[#555C56] transition duration-200 hover:border-[#BFC4BE] hover:bg-[#F8F8F5]"
        >
          다시 분석하기
        </button>
        <button
          onClick={onResults}
          className="col-span-2 rounded-full bg-[#242925] px-3 py-4 text-sm font-bold text-white shadow-[0_14px_28px_rgba(31,35,32,0.15)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#171B18]"
        >
          AI 의상 추천받기 →
        </button>
      </div>
    </>
  );
}

function RecommendationLoading({ title, description }) {
  return (
    <main
      className="flex min-h-[calc(100vh-6rem)] items-center justify-center px-4"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="w-[440px] rounded-[24px] border border-[#E0E2DD] bg-white px-9 py-10 text-center shadow-[0_22px_60px_rgba(31,35,32,0.08)]">
        <span className="relative mx-auto block size-14" aria-hidden="true">
          <span className="absolute inset-0 animate-ping rounded-full bg-[#D9CDF8]/50" />
          <span className="absolute inset-1 animate-spin rounded-full border-4 border-[#ECE9F8] border-t-[#6D5CCF]" />
        </span>
        <h1 className="mt-7 text-xl font-bold tracking-[-0.02em] text-[#272C28]">
          {title}
        </h1>
        <p className="mt-2 text-sm font-medium leading-6 text-[#7A817A]">
          {description}
        </p>
      </div>
    </main>
  );
}

function RecommendationItemSkeleton({ index = 0 }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: [0, -3, 0] }}
      transition={{
        opacity: { duration: 0.3, delay: Math.min(index * 0.035, 0.28) },
        y: {
          duration: 2.4,
          delay: (index % 5) * 0.08,
          ease: "easeInOut",
          repeat: Infinity,
        },
      }}
      className="relative overflow-hidden rounded-[24px] border border-[#E1E3DE] bg-white shadow-[0_12px_30px_rgba(31,35,32,0.05)]"
      aria-label="추천 의상 정보를 불러오는 중"
    >
      <div className="aspect-[3/4] bg-[#E6E7E3]" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-2/5 rounded-full bg-[#E4E5E1]" />
        <div className="h-4 w-4/5 rounded-full bg-[#E4E5E1]" />
        <div className="h-4 w-1/2 rounded-full bg-[#E4E5E1]" />
        <div className="h-3 w-3/5 rounded-full bg-[#E4E5E1]" />
      </div>
      <motion.span
        aria-hidden="true"
        initial={{ x: "-120%" }}
        animate={{ x: "120%" }}
        transition={{
          duration: 1.55,
          delay: (index % 5) * 0.1,
          ease: "linear",
          repeat: Infinity,
          repeatDelay: 0.35,
        }}
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/65 to-transparent"
      />
    </motion.article>
  );
}

function RecommendationResults({
  items,
  emptyReason,
  isPending,
  isReplacing,
  isCreatingRoom,
  error,
  actionError,
  replacementNotice,
  selectedProductIds,
  replacingProductIds,
  canRequestActions,
  onBack,
  onToggleProduct,
  onReplaceSelected,
  onReplaceAll,
  onCreateRoom,
}) {
  const [isSelectionGuideDismissed, setIsSelectionGuideDismissed] =
    useState(false);

  if (isPending && items.length > 0) {
    return (
      <RecommendationLoading
        title="사용자 맞춤형 의상을 선별 중입니다"
        description="AI가 입력하신 조건을 분석하고 있습니다. 잠시만 기다려 주세요."
      />
    );
  }

  if (isReplacing && replacingProductIds.length === 0) {
    return (
      <RecommendationLoading
        title="선택한 의상을 다시 추천하는 중입니다"
        description="더 잘 어울리는 의상을 찾는 동안 잠시만 기다려 주세요."
      />
    );
  }

  if (isCreatingRoom) {
    return (
      <RecommendationLoading
        title="티어메이커 방을 만들고 있습니다"
        description="추천 결과를 방에 담고 있습니다. 잠시만 기다려 주세요."
      />
    );
  }

  if (error)
    return (
      <main className="flex min-h-[calc(100vh-6rem)] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-[24px] border border-[#E0E2DD] bg-white p-8 text-center shadow-[0_20px_55px_rgba(31,35,32,0.08)]">
          <span className="mx-auto flex size-10 items-center justify-center rounded-[14px] bg-red-50 text-lg font-bold text-red-500">
            !
          </span>
          <p className="mt-4 text-sm font-medium text-red-700">
            {getRecommendationErrorMessage(error)}
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-6 rounded-full bg-[#242925] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#171B18]"
          >
            추천 조건으로 돌아가기
          </button>
        </div>
      </main>
    );
  return (
    <main className="min-h-[calc(100vh-6rem)] px-6 py-8 text-[#242925] sm:px-10 lg:px-14">
      <div className="mx-auto max-w-[1320px]">
        <header className="mb-6 flex items-center justify-between gap-4 rounded-[24px] border border-[#E0E2DD] bg-white px-6 py-5 shadow-[0_16px_42px_rgba(31,35,32,0.06)]">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="group text-sm font-semibold text-[#747B75] transition-colors hover:text-[#242925]"
            >
              <span className="mr-1 inline-block transition-transform duration-200 group-hover:-translate-x-1">
                ←
              </span>
              추천 조건으로 돌아가기
            </button>
            {isPending ? (
              <div
                className="mt-2 flex items-center gap-2.5"
                role="status"
                aria-live="polite"
              >
                <span
                  className="size-5 animate-spin rounded-full border-[3px] border-[#E5E1F5] border-t-[#6D5CCF]"
                  aria-hidden="true"
                />
                <h1 className="text-[24px] font-black tracking-[-0.035em]">
                  AI가 의상 추천을 수행하는 중
                </h1>
              </div>
            ) : (
              <h1 className="mt-2 text-[26px] font-black tracking-[-0.035em]">
                {items.length}개 추천 아이템
              </h1>
            )}
            <p className="mt-1 text-xs font-medium text-[#939892]">
              {isPending
                ? "입력한 조건과 체형 정보를 바탕으로 어울리는 의상을 찾고 있어요."
                : "마음에 들지 않는 의상을 선택하면 해당 항목만 다시 추천받을 수 있어요."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={onReplaceAll}
              disabled={!canRequestActions || items.length === 0 || isReplacing}
              className="rounded-full border border-[#DADDD7] bg-white px-5 py-3 text-sm font-bold text-[#555C56] transition duration-200 hover:-translate-y-0.5 hover:border-[#BFC4BE] hover:bg-[#F8F8F5] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
            >
              전체 다시 추천받기
            </button>
            <AnimatePresence initial={false}>
              {selectedProductIds.length > 0 && (
                <motion.button
                  key="replace-selected"
                  type="button"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  onClick={onReplaceSelected}
                  disabled={!canRequestActions || isReplacing}
                  className="rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-600 transition duration-200 hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  선택한 {selectedProductIds.length}개 항목 다시 추천받기
                </motion.button>
              )}
            </AnimatePresence>
            <button
              type="button"
              onClick={onCreateRoom}
              disabled={!canRequestActions || items.length === 0 || isReplacing}
              className="rounded-full bg-[#242925] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(31,35,32,0.14)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#171B18] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
            >
              티어 메이커로 이동
            </button>
          </div>
        </header>

        {actionError && (
          <p className="mb-4 rounded-[18px] border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-700 shadow-sm">
            {actionError}
          </p>
        )}
        {replacementNotice && (
          <p className="mb-4 rounded-[18px] border border-[#DDD8F6] bg-[#F2EFFC] px-5 py-4 text-sm font-medium text-[#6454B8] shadow-sm">
            {replacementNotice}
          </p>
        )}
        {!isPending && items.length > 0 && !isSelectionGuideDismissed && (
          <motion.p
            initial={{ opacity: 0, height: 0, marginBottom: 0, y: -6 }}
            animate={{
              opacity: [0, 1, 1, 0],
              height: [0, 40, 40, 0],
              marginBottom: [0, 16, 16, 0],
              y: [-6, 0, 0, -6],
            }}
            transition={{
              duration: 4,
              times: [0, 0.12, 0.8, 1],
              ease: "easeInOut",
            }}
            onAnimationComplete={() => setIsSelectionGuideDismissed(true)}
            className="flex overflow-hidden rounded-[18px] border border-red-100 bg-red-50 px-5 text-sm font-semibold text-red-600"
          >
            <span className="my-auto">
              마음에 들지 않는 의상을 선택하고 다시 추천받아보세요
            </span>
          </motion.p>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {isPending
            ? Array.from({ length: 10 }, (_, index) => (
                <RecommendationItemSkeleton
                  key={`recommendation-skeleton-${index}`}
                  index={index}
                />
              ))
            : items.map((item, index) => {
                const productId = item.productId ?? item.id;
                const name = item.name ?? item.productName ?? "추천 의상";
                const image = item.imageUrl ?? item.thumbnailUrl ?? item.image;
                const isSelected = selectedProductIds.includes(productId);
                const isReplacingItem =
                  isReplacing &&
                  replacingProductIds.some(
                    (replacingProductId) =>
                      String(replacingProductId) === String(productId),
                  );

                if (isReplacingItem) {
                  return (
                    <RecommendationItemSkeleton
                      key={`replacement-skeleton-${productId ?? index}`}
                      index={index}
                    />
                  );
                }

                return (
                  <motion.article
                    key={productId ?? index}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.045, 0.36) }}
                    className={`group relative overflow-hidden rounded-[24px] border-2 bg-white shadow-[0_12px_30px_rgba(31,35,32,0.05)] transition-all duration-300 ${
                      isSelected
                        ? "-translate-y-1 border-red-500 ring-4 ring-red-100 shadow-[0_20px_42px_rgba(220,38,38,0.12)]"
                        : "border-white hover:-translate-y-1 hover:border-[#DDD8F6] hover:shadow-[0_22px_44px_rgba(31,35,32,0.12)]"
                    }`}
                  >
                    <label className="block cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleProduct(productId)}
                        disabled={isReplacing}
                        className="sr-only"
                      />
                      <span
                        className={`absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full border-2 text-sm font-black shadow-md transition-all duration-250 ${
                          isSelected
                            ? "scale-100 border-red-500 bg-red-500 text-white"
                            : "scale-90 border-white bg-white/90 text-transparent group-hover:scale-100"
                        }`}
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                      <div className="aspect-[3/4] overflow-hidden bg-[#E6E7E3]">
                        {image ? (
                          <img
                            src={image}
                            alt={name}
                            className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035]"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-xs font-medium text-[#969B96]">
                            상품 이미지 준비 중
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <p className="truncate text-[11px] font-bold tracking-[0.04em] text-[#8C928C]">
                          {item.brand ?? "브랜드 정보 없음"}
                        </p>
                        <p className="mt-1.5 truncate text-sm font-bold text-[#2D322E]">
                          {name}
                        </p>
                        <p className="mt-3 text-sm font-black text-[#242925]">
                          {item.price != null
                            ? `${Number(item.price).toLocaleString()}원`
                            : "가격 정보 없음"}
                        </p>
                        <p className="mt-1 truncate text-xs font-medium text-[#8A908A]">
                          {[item.category, item.subcategory]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </label>
                    {item.purchaseUrl && (
                      <a
                        href={item.purchaseUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mx-4 mb-4 block rounded-full border border-[#E0E2DD] bg-[#F7F7F4] px-3 py-2.5 text-center text-xs font-bold text-[#626963] transition duration-200 hover:border-[#CFC6F4] hover:bg-[#F1EEF9] hover:text-[#5D4EB1]"
                      >
                        상품 보러가기
                      </a>
                    )}
                  </motion.article>
                );
              })}
        </div>
        {!isPending && !items.length && (
          <div className="rounded-[24px] border border-dashed border-[#D5D8D2] bg-white/65 py-24 text-center">
            <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-[15px] bg-[#ECEDE9] text-xl text-[#858B85]">
              ···
            </span>
            <p className="text-sm font-medium text-[#818781]">
              {emptyReason ?? "조건에 맞는 추천 의상이 없습니다."}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function Tag({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${active ? "border-[#6D5CCF] bg-[#6D5CCF] text-white shadow-[0_8px_18px_rgba(109,92,207,0.22)]" : "border-[#DDE0DA] bg-white text-[#697069] hover:-translate-y-0.5 hover:border-[#AFA2E8] hover:bg-[#FAF9FF]"}`}
    >
      {children}
    </button>
  );
}

export default RecommendationPage;
