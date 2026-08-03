import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  createRecommendation,
  getRecommendationOptions,
  replaceRecommendationItems,
} from "@/api/recommendations";
import { getMyAvatar } from "@/api/users";
import AvatarSetupPrompt from "@/components/common/AvatarSetupPrompt";
import ClothingAddModal from "@/components/recommendation/ClothingAddModal";
import { getApiErrorMessage } from "@/utils/apiError";
import { getRoomSession } from "@/utils/roomSessionStorage";

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
const createIdempotencyKey = () => crypto.randomUUID();
const getReplaceErrorMessage = (error) =>
  error?.response?.status === 409
    ? "추천 결과가 변경되었습니다. 최신 결과를 다시 확인해 주세요."
    : getApiErrorMessage(error, "의상을 추가하지 못했습니다.");
const getRecommendationErrorMessage = (error) => {
  if (error?.response?.status === 403)
    return "이 추천 결과를 조회할 권한이 없습니다.";
  if (error?.response?.status === 404) return "추천 결과를 찾을 수 없습니다.";
  return getApiErrorMessage(error, "추천 결과를 불러오지 못했습니다.");
};

function RecommendationPage() {
  const [step, setStep] = useState("form");
  const [recommendation, setRecommendation] = useState(null);
  const [submittedConditions, setSubmittedConditions] = useState(null);
  const [submittedRecommendation, setSubmittedRecommendation] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    category: "",
    subcategory: "",
    minPrice: "",
    maxPrice: "",
    moodCodes: [],
    additionalInfo: "",
    referenceImages: [],
  });
  const roomSession = getRoomSession();

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
  const categories = toArray(options.categories);
  const moods = toArray(options.moods);
  const budgetPolicy = options.budgetPolicy ?? {};

  useEffect(() => {
    if (!optionsQuery.data) return;

    setForm((current) => ({
      ...current,
      minPrice: current.minPrice || String(budgetPolicy.minAllowed ?? ""),
      maxPrice: current.maxPrice || String(budgetPolicy.maxAllowed ?? ""),
    }));
  }, [budgetPolicy.maxAllowed, budgetPolicy.minAllowed, optionsQuery.data]);

  useEffect(() => {
    const firstCategory = categories[0];
    if (!firstCategory) return;

    setForm((current) => ({
      ...current,
      category: current.category || firstCategory.code,
      subcategory:
        current.subcategory || firstCategory.subcategories?.[0]?.code || "",
    }));
  }, [categories]);

  const createMutation = useMutation({
    mutationFn: createRecommendation,
    onSuccess: (response) => {
      setRecommendation(unwrap(response));
    },
  });
  const recommendationId =
    recommendation?.recommendationId ?? recommendation?.id;
  const recommendationResult = recommendation;
  const replaceMutation = useMutation({
    mutationFn: replaceRecommendationItems,
    onSuccess: (response) => {
      const updatedRecommendation = unwrap(response);
      setRecommendation(updatedRecommendation);
      setIsModalOpen(false);
    },
  });

  const recommendedItems = useMemo(
    () =>
      toArray(
        recommendationResult?.items ??
          recommendationResult?.recommendedItems ??
          recommendationResult?.products,
      ),
    [recommendationResult],
  );

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
    const selectedCategory = categories.find(
      (category) => category.code === form.category,
    );
    const selectedSubcategory = selectedCategory?.subcategories?.find(
      (subcategory) => subcategory.code === form.subcategory,
    );
    setSubmittedConditions({
      category: selectedCategory?.label ?? form.category,
      subcategory: selectedSubcategory?.label ?? form.subcategory,
      moods: moods
        .filter((mood) => form.moodCodes.includes(mood.code))
        .map((mood) => mood.label),
      budgetMin: Number(form.minPrice),
      budgetMax: Number(form.maxPrice),
    });
    setSubmittedRecommendation({
      category: form.category,
      subcategory: form.subcategory,
      budgetMin: Number(form.minPrice),
      budgetMax: Number(form.maxPrice),
      moods: form.moodCodes,
    });
    setRecommendation(null);
    createMutation.reset();
    setStep("analysis");
  };
  const handleRecommend = () => {
    if (!submittedRecommendation || createMutation.isPending) return;

    setRecommendation(null);
    setIsModalOpen(false);
    setStep("results");
    createMutation.mutate({
      recommendation: submittedRecommendation,
      idempotencyKey: createIdempotencyKey(),
    });
  };
  const handleAdd = (clothing) => {
    const productId = clothing.productId ?? clothing.id;
    replaceMutation.mutate({
      recommendationId,
      baseVersion: recommendationResult?.version,
      productIds: [productId],
      idempotencyKey: createIdempotencyKey(),
    });
  };

  if (avatarQuery.isPending || avatarQuery.isFetching) {
    return (
      <main className="min-h-screen bg-[#f4f3ef] px-4 py-10 sm:py-16">
        <div className="mx-auto h-72 max-w-xl animate-pulse rounded-3xl bg-white" />
      </main>
    );
  }

  if (avatarQuery.isError) {
    if (avatarQuery.error.response?.status === 404) {
      return (
        <main className="min-h-screen bg-[#f4f3ef] px-4 py-10 sm:py-16">
          <AvatarSetupPrompt />
        </main>
      );
    }

    return (
      <main className="min-h-screen bg-[#f4f3ef] px-4 py-10 sm:py-16">
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
      <>
        <RecommendationResults
          items={recommendedItems}
          emptyReason={recommendationResult?.emptyReason}
          isPending={
            createMutation.isPending ||
            (!recommendationResult && !createMutation.isError)
          }
          error={createMutation.error}
          onBack={() => setStep("analysis")}
          onOpenModal={() => setIsModalOpen(true)}
        />
        {isModalOpen && recommendationResult && (
          <ClothingAddModal
            roomToken={roomSession?.roomToken}
            onClose={() => setIsModalOpen(false)}
            onAdd={handleAdd}
          />
        )}
        {replaceMutation.isError && (
          <p className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-red-600 px-4 py-3 text-sm text-white">
            {getReplaceErrorMessage(replaceMutation.error)}
          </p>
        )}
      </>
    );

  return (
    <main className="min-h-screen bg-[#f4f3ef] px-4 py-10 text-slate-900 sm:py-16">
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
        {step === "form" ? (
          <RecommendationForm
            form={form}
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
      </section>
      {isModalOpen && (
        <ClothingAddModal
          roomToken={roomSession?.roomToken}
          onClose={() => setIsModalOpen(false)}
          onAdd={handleAdd}
        />
      )}
      {replaceMutation.isError && (
        <p className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-xl bg-red-600 px-4 py-3 text-sm text-white">
          {getReplaceErrorMessage(replaceMutation.error)}
        </p>
      )}
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
  const changeImages = (event) =>
    onChange({
      ...form,
      referenceImages: Array.from(event.target.files ?? []).slice(0, 3),
    });
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
        <span>{isAdditionalInfoOpen ? "⌃" : "⌄"}</span> 추가 정보 입력하기
      </button>
      {isAdditionalInfoOpen && (
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold">참고 이미지 첨부</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {[0, 1, 2].map((index) => (
              <label
                key={index}
                className="flex size-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-center text-xs text-slate-400 hover:border-slate-400"
              >
                <span className="text-xl leading-none">+</span>
                <span className="mt-2 break-all px-1">
                  {form.referenceImages[index]?.name ?? "이미지 추가"}
                </span>
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  onChange={changeImages}
                />
              </label>
            ))}
          </div>
          <label className="mt-5 block text-sm font-semibold">
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
        </section>
      )}
      <button
        disabled={
          !form.category ||
          !form.subcategory ||
          !form.minPrice ||
          !form.maxPrice
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

function RecommendationResults({
  items,
  emptyReason,
  isPending,
  error,
  onBack,
  onOpenModal,
}) {
  if (isPending)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f3ef] px-4">
        <div className="text-center">
          <span
            className="mx-auto block size-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900"
            aria-hidden="true"
          />
          <h1 className="mt-6 text-xl font-bold text-slate-950">
            AI가 의상을 추천하는 중
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            추천 결과를 준비하고 있습니다. 잠시만 기다려 주세요.
          </p>
        </div>
      </main>
    );
  if (error)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f3ef] px-4">
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
    <main className="min-h-screen bg-[#f4f3ef] p-4 sm:p-6">
      <header className="mb-5 flex items-center justify-between">
        <button onClick={onBack} className="font-bold">
          ← {items.length}개 추천 아이템
        </button>
        <button
          onClick={onOpenModal}
          className="rounded-xl bg-white px-4 py-2 text-sm font-bold shadow-sm"
        >
          ＋ 의상 추가
        </button>
      </header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item, index) => {
          const name = item.name ?? item.productName ?? "추천 의상";
          const image = item.imageUrl ?? item.thumbnailUrl ?? item.image;
          return (
            <article
              key={item.productId ?? item.id ?? index}
              className="overflow-hidden rounded-2xl bg-white shadow-sm"
            >
              <div className="aspect-[3/4] bg-slate-200">
                {image && (
                  <img
                    src={image}
                    alt={name}
                    className="size-full object-cover"
                  />
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-bold">{name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.price
                    ? `₩${Number(item.price).toLocaleString()}`
                    : (item.categoryName ?? item.category ?? "")}
                </p>
              </div>
            </article>
          );
        })}
      </div>
      {!items.length && (
        <p className="py-24 text-center text-slate-400">
          {emptyReason ?? "조건에 맞는 추천 의상이 없습니다."}
        </p>
      )}
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
