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
import AvatarSetupPrompt from "@/components/common/AvatarSetupPrompt";
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
  const selectedFormCategory =
    categories.find((category) => category.code === form.category) ??
    categories[0];
  const recommendationForm = {
    ...form,
    category: selectedFormCategory?.code ?? form.category,
    subcategory:
      form.subcategory || selectedFormCategory?.subcategories?.[0]?.code || "",
    minPrice: form.minPrice || String(budgetPolicy.minAllowed ?? ""),
    maxPrice: form.maxPrice || String(budgetPolicy.maxAllowed ?? ""),
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
        const nextItems =
          responseItems.length > 0
            ? responseItems
            : currentItems.map((item) => {
                const productId = item.productId ?? item.id;
                const replacement = replacements.find(
                  (currentReplacement) =>
                    String(currentReplacement.oldProductId) ===
                    String(productId),
                );

                if (!replacement) return item;

                return {
                  ...replacement,
                  productId: replacement.newProductId,
                  rank: replacement.position ?? item.rank,
                };
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
    setForm((current) => ({
      ...current,
      moodCodes: current.moodCodes.includes(moodCode)
        ? current.moodCodes.filter((item) => item !== moodCode)
        : [...current.moodCodes, moodCode],
    }));
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
    setReplacementNotice("");
    setStep("analysis");
  };
  const handleRecommend = () => {
    if (!submittedRecommendation || createMutation.isPending) return;

    setRecommendation(null);
    setSelectedProductIds([]);
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
  const handleReplaceSelected = () => {
    if (
      !recommendationId ||
      !recommendationResult?.version ||
      selectedProductIds.length === 0 ||
      replaceMutation.isPending
    ) {
      return;
    }

    setReplacementNotice("");
    createRoomMutation.reset();
    replaceMutation.mutate({
      recommendationId,
      baseVersion: recommendationResult?.version,
      productIds: selectedProductIds.map(Number),
      idempotencyKey: createIdempotencyKey(),
    });
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
      <main className="min-h-screen bg-gray-50 px-4 py-10 sm:py-16">
        <div className="mx-auto h-72 max-w-xl animate-pulse rounded-3xl bg-white" />
      </main>
    );
  }

  if (avatarQuery.isError) {
    if (avatarQuery.error.response?.status === 404) {
      return (
        <main className="min-h-screen bg-gray-50 px-4 py-10 sm:py-16">
          <AvatarSetupPrompt />
        </main>
      );
    }

    return (
      <main className="min-h-screen bg-gray-50 px-4 py-10 sm:py-16">
        <p className="mx-auto max-w-xl rounded-2xl bg-red-50 p-4 text-sm text-red-700">
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
          canRequestActions={Boolean(
            recommendationId && recommendationResult?.version,
          )}
          onBack={() => setStep("analysis")}
          onToggleProduct={toggleSelectedProduct}
          onReplaceSelected={handleReplaceSelected}
          onCreateRoom={handleCreateRoom}
        />
      </motion.div>
    );

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 text-slate-900 sm:py-16">
      <section className="mx-auto max-w-xl">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {step === "form" ? "의상 추천받기" : "AI 분석 결과"}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {step === "form"
                ? "추천을 위한 사용자 정보 입력"
                : "입력하신 조건을 확인해 주세요."}
            </p>
          </div>
          <div className="flex gap-1">
            <i className="h-2 w-5 rounded-full bg-slate-900" />
            <i
              className={`size-2 rounded-full ${step === "analysis" ? "bg-slate-900" : "bg-slate-300"}`}
            />
            <i className="size-2 rounded-full bg-slate-300" />
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
  const [isAdditionalInfoOpen, setIsAdditionalInfoOpen] = useState(false);
  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white";
  if (optionsQuery.isPending)
    return (
      <div className="rounded-3xl bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
        추천 옵션을 불러오는 중입니다.
      </div>
    );
  if (optionsQuery.isError)
    return (
      <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
        {getApiErrorMessage(
          optionsQuery.error,
          "추천 옵션을 불러오지 못했습니다.",
        )}
      </p>
    );
  if (categories.length === 0)
    return (
      <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
        선택할 수 있는 상의 또는 하의 카테고리가 없습니다.
      </p>
    );

  const selectedCategory = categories.find(
    (category) => category.code === form.category,
  );
  const subcategories = selectedCategory?.subcategories ?? [];

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <label className="block text-sm font-semibold">
          카테고리
          <select
            value={form.category}
            onChange={(event) => onCategory(event.target.value)}
            className={inputClass}
          >
            {categories.map((category) => (
              <option key={category.code} value={category.code}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-5 block text-sm font-semibold">
          세부 분류
          <select
            value={form.subcategory}
            onChange={(event) =>
              onChange({ ...form, subcategory: event.target.value })
            }
            className={inputClass}
          >
            {subcategories.map((subcategory) => (
              <option key={subcategory.code} value={subcategory.code}>
                {subcategory.label}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-6 text-sm font-semibold">예산</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <input
            type="number"
            min={budgetPolicy.minAllowed}
            max={budgetPolicy.maxAllowed}
            step={budgetPolicy.step}
            value={form.minPrice}
            onChange={(event) =>
              onChange({ ...form, minPrice: event.target.value })
            }
            placeholder="최소 금액"
            className={inputClass.replace("mt-2 ", "")}
          />
          <input
            type="number"
            min={budgetPolicy.minAllowed}
            max={budgetPolicy.maxAllowed}
            step={budgetPolicy.step}
            value={form.maxPrice}
            onChange={(event) =>
              onChange({ ...form, maxPrice: event.target.value })
            }
            placeholder="최대 금액"
            className={inputClass.replace("mt-2 ", "")}
          />
        </div>
        <p className="mt-6 text-sm font-semibold">선호 무드</p>
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
      <button
        type="button"
        onClick={() => setIsAdditionalInfoOpen((current) => !current)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-4 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
        aria-expanded={isAdditionalInfoOpen}
      >
        추가 정보 입력하기
      </button>
      <AnimatePresence>
      {isAdditionalInfoOpen && (
        <motion.section
          initial={{ opacity: 0, height: 0, y: -8 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0, y: -8 }}
          className="overflow-hidden rounded-3xl bg-white p-6 shadow-sm"
        >
          <label className="block text-sm font-semibold">
            TPO 입력
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
          <p className="mt-2 text-right text-xs text-slate-400">
            {form.additionalInfo.length} / 300자
          </p>
        </motion.section>
      )}
      </AnimatePresence>
      <button
        disabled={
          !form.category ||
          !form.subcategory ||
          !form.minPrice ||
          !form.maxPrice ||
          form.moodCodes.length === 0
        }
        className="w-full rounded-2xl bg-slate-950 py-4 font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        입력 완료 › 조건 확인
      </button>
    </form>
  );
}

function AnalysisCard({ fallbackConditions, onRetry, onResults }) {
  const conditions = fallbackConditions ?? {};
  return (
    <>
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="border-b pb-4 text-base font-bold">⚡ 추천 조건 확인</p>
        <dl className="mt-4 grid grid-cols-[80px_1fr] gap-y-4 text-sm">
          <dt className="text-slate-400">카테고리</dt>
          <dd className="font-semibold">
            {[conditions.category, conditions.subcategory]
              .filter(Boolean)
              .join(" · ") || "입력한 조건"}
          </dd>
          <dt className="text-slate-400">무드</dt>
          <dd className="font-semibold">
            {conditions.moods?.join(", ") || "선택 안 함"}
          </dd>
          <dt className="text-slate-400">가격대</dt>
          <dd className="font-semibold">{`${Number(conditions.budgetMin ?? 0).toLocaleString()}원 ~ ${Number(conditions.budgetMax ?? 0).toLocaleString()}원`}</dd>
          {conditions.additionalInfo && (
            <>
              <dt className="text-slate-400">TPO</dt>
              <dd className="whitespace-pre-wrap font-semibold">
                {conditions.additionalInfo}
              </dd>
            </>
          )}
        </dl>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <button
          onClick={onRetry}
          className="rounded-2xl bg-white px-3 py-4 text-sm font-bold"
        >
          다시 분석하기
        </button>
        <button
          onClick={onResults}
          className="col-span-2 rounded-2xl bg-slate-950 px-3 py-4 text-sm font-bold text-white"
        >
          ⚡ AI 의상 추천받기
        </button>
      </div>
    </>
  );
}

function RecommendationLoading({ title, description }) {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-gray-50 px-4"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="text-center">
        <span
          className="mx-auto block size-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900"
          aria-hidden="true"
        />
        <h1 className="mt-6 text-xl font-bold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
      </div>
    </main>
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
  canRequestActions,
  onBack,
  onToggleProduct,
  onReplaceSelected,
  onCreateRoom,
}) {
  if (isPending) {
    return (
      <RecommendationLoading
        title="사용자 맞춤형 의상을 선별 중입니다"
        description="AI가 입력하신 조건을 분석하고 있습니다. 잠시만 기다려 주세요."
      />
    );
  }

  if (isReplacing) {
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
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-red-700">
            {getRecommendationErrorMessage(error)}
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-6 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"
          >
            추천 조건으로 돌아가기
          </button>
        </div>
      </main>
    );
  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8 text-slate-950 sm:px-10 lg:px-14">
      <div className="mx-auto max-w-[1320px]">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              ← 추천 조건으로 돌아가기
            </button>
            <h1 className="mt-2 text-2xl font-black">
              {items.length}개 추천 아이템
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              다시 추천받을 의상을 복수로 선택할 수 있습니다.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <AnimatePresence initial={false}>
              {selectedProductIds.length > 0 && (
                <motion.button
                  key="replace-selected"
                  type="button"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  onClick={onReplaceSelected}
                  disabled={!canRequestActions}
                  className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 shadow-sm transition hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  선택한 {selectedProductIds.length}개 항목 다시 추천받기
                </motion.button>
              )}
            </AnimatePresence>
            <button
              type="button"
              onClick={onCreateRoom}
              disabled={!canRequestActions || items.length === 0}
              className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              티어 메이커로 이동
            </button>
          </div>
        </header>

        {actionError && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </p>
        )}
        {replacementNotice && (
          <p className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {replacementNotice}
          </p>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item, index) => {
            const productId = item.productId ?? item.id;
            const name = item.name ?? item.productName ?? "추천 의상";
            const image = item.imageUrl ?? item.thumbnailUrl ?? item.image;
            const isSelected = selectedProductIds.includes(productId);
            return (
              <motion.article
                key={productId ?? index}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.045, 0.36) }}
                className={`relative overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition ${
                  isSelected
                    ? "border-red-500 ring-4 ring-red-100"
                    : "border-transparent hover:-translate-y-0.5 hover:shadow-lg"
                }`}
              >
                <label className="block cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleProduct(productId)}
                    className="sr-only"
                  />
                  <span
                    className={`absolute right-3 top-3 z-10 flex size-7 items-center justify-center rounded-full border-2 text-sm font-black shadow-sm ${
                      isSelected
                        ? "border-red-500 bg-red-500 text-white"
                        : "border-white bg-white/90 text-transparent"
                    }`}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  <div className="aspect-[3/4] bg-slate-200">
                    {image ? (
                      <img
                        src={image}
                        alt={name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-xs text-slate-400">
                        상품 이미지 준비 중
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="truncate text-xs font-semibold text-slate-400">
                      {item.brand ?? "브랜드 정보 없음"}
                    </p>
                    <p className="mt-1 truncate text-sm font-bold">{name}</p>
                    <p className="mt-2 text-sm font-black">
                      {item.price != null
                        ? `${Number(item.price).toLocaleString()}원`
                        : "가격 정보 없음"}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
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
                    className="mx-4 mb-4 block rounded-lg bg-slate-100 px-3 py-2 text-center text-xs font-bold text-slate-700 hover:bg-slate-200"
                  >
                    상품 보러가기
                  </a>
                )}
              </motion.article>
            );
          })}
        </div>
        {!items.length && (
          <p className="py-24 text-center text-slate-400">
            {emptyReason ?? "조건에 맞는 추천 의상이 없습니다."}
          </p>
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
      className={`rounded-full border px-3 py-1.5 text-sm transition ${active ? "border-slate-900 bg-slate-900 text-white" : "bg-white text-slate-500 hover:border-slate-400"}`}
    >
      {children}
    </button>
  );
}

export default RecommendationPage;
