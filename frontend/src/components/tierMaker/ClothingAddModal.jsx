import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";

import { searchProducts } from "@/api/products";
import { getApiErrorMessage } from "@/utils/apiError";
import { normalizeTierMakerSubcategory } from "@/utils/tierMakerClothing";

const EMPTY_FILTERS = {
  category: "",
  subcategory: "",
  minPrice: "",
  maxPrice: "",
  keyword: "",
};

const SUBCATEGORY_OPTIONS = {
  BOTTOM: [
    "COTTON_PANTS",
    "DENIM_PANTS",
    "JOGGER_PANTS",
    "OTHER_BOTTOM",
    "SHORTS",
    "SKIRT",
    "SLACKS",
    "SPORTS_BOTTOM",
  ],
  TOP: [
    "DRESS",
    "HOODIE",
    "JACKET",
    "KNIT",
    "LONG_SLEEVE",
    "OTHER_TOP",
    "SHIRT",
    "SHORT_SLEEVE",
    "SLEEVELESS",
    "SPORTS_TOP",
  ],
};

function createSearchParams(filters, page) {
  const params = {};

  if (filters.category) params.category = filters.category;
  if (filters.minPrice !== "") params.minPrice = Number(filters.minPrice);
  if (filters.maxPrice !== "") params.maxPrice = Number(filters.maxPrice);
  if (filters.keyword.trim()) params.keyword = filters.keyword.trim();
  if (page > 0) params.page = page;

  return params;
}

function getProductSearchResult(response) {
  const candidates = [response?.data, response, response?.data?.data];

  return (
    candidates.find((candidate) => Array.isArray(candidate?.products)) ?? {}
  );
}

function ClothingAddModal({
  roomToken,
  onClose,
  onAdd,
  isAdding,
  addingProductId,
  addError,
}) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [validationError, setValidationError] = useState("");
  const availableSubcategories = filters.category
    ? (SUBCATEGORY_OPTIONS[filters.category] ?? [])
    : Object.values(SUBCATEGORY_OPTIONS).flat();
  const productsQuery = useQuery({
    queryKey: ["roomProductSearch", roomToken, appliedFilters, page],
    queryFn: () =>
      searchProducts({
        roomToken,
        params: createSearchParams(appliedFilters, page),
      }),
    enabled: Boolean(roomToken),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const result = getProductSearchResult(productsQuery.data);
  const products = Array.isArray(result.products) ? result.products : [];
  const filteredProducts = appliedFilters.subcategory
    ? products.filter(
        (product) =>
          normalizeTierMakerSubcategory(product.subcategory) ===
          normalizeTierMakerSubcategory(appliedFilters.subcategory),
      )
    : products;
  const currentPage = Number(result.page ?? page);
  const pageSize = Number(result.size ?? 20);
  const totalElements = Number(result.totalElements ?? filteredProducts.length);
  const hasNextPage = (currentPage + 1) * pageSize < totalElements;

  const handleSubmit = (event) => {
    event.preventDefault();
    const minPrice = filters.minPrice === "" ? 0 : Number(filters.minPrice);
    const maxPrice =
      filters.maxPrice === "" ? 5_000_000 : Number(filters.maxPrice);

    if (minPrice > maxPrice) {
      setValidationError("최소 금액은 최대 금액보다 클 수 없습니다.");
      return;
    }

    setValidationError("");
    setPage(0);
    setAppliedFilters({ ...filters });
  };

  const handleReset = () => {
    setFilters({ ...EMPTY_FILTERS });
    setAppliedFilters({ ...EMPTY_FILTERS });
    setValidationError("");
    setPage(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="의상 추가"
    >
      <motion.section
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.985 }}
        className="flex h-[min(820px,calc(100vh-2rem))] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">의상 추가</h2>
            <p className="mt-1 text-sm text-slate-500">
              상품을 검색해 티어메이커 후보 또는 피팅 보관함에 추가하세요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isAdding}
            className="grid size-9 place-items-center rounded-full border text-lg text-slate-400 hover:bg-slate-50 disabled:opacity-50"
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-[1fr_1fr_150px_150px] gap-3 border-b border-slate-100 px-6 py-4"
        >
          <select
            value={filters.category}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                category: event.target.value,
                subcategory: "",
              }))
            }
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400"
          >
            <option value="">전체 카테고리</option>
            <option value="TOP">TOP</option>
            <option value="BOTTOM">BOTTOM</option>
          </select>
          <select
            value={filters.subcategory}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                subcategory: event.target.value,
              }))
            }
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400"
          >
            <option value="">전체 상세 카테고리</option>
            {availableSubcategories.map((subcategory) => (
              <option key={subcategory} value={subcategory}>
                {subcategory}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            max="5000000"
            value={filters.minPrice}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                minPrice: event.target.value,
              }))
            }
            placeholder="최소 금액"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400"
          />
          <input
            type="number"
            min="0"
            max="5000000"
            value={filters.maxPrice}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                maxPrice: event.target.value,
              }))
            }
            placeholder="최대 금액"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400"
          />
          <input
            value={filters.keyword}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                keyword: event.target.value,
              }))
            }
            placeholder="브랜드명 또는 상품명 검색"
            className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400"
          />
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            필터 초기화
          </button>
          <button
            type="submit"
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
          >
            검색
          </button>
        </form>

        {(validationError || addError) && (
          <p className="mx-6 mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {validationError ||
              getApiErrorMessage(addError, "후보 의상을 추가하지 못했습니다.")}
          </p>
        )}

        <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-2 content-start gap-3 overflow-y-auto p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {productsQuery.isPending && (
            <p className="col-span-full py-24 text-center text-sm text-slate-400">
              의상을 검색하는 중입니다.
            </p>
          )}
          {productsQuery.isError && (
            <p className="col-span-full py-24 text-center text-sm text-red-600">
              {getApiErrorMessage(
                productsQuery.error,
                "의상 검색에 실패했습니다.",
              )}
            </p>
          )}
          {!productsQuery.isPending &&
            !productsQuery.isError &&
            filteredProducts.map((product) => {
              const productDetails =
                product.product ?? product.productInfo ?? product.item ?? {};
              const productId =
                product.productId ??
                product.id ??
                productDetails.productId ??
                productDetails.id;
              const name =
                product.name ||
                product.productName ||
                productDetails.name ||
                productDetails.productName ||
                "이름 없는 의상";
              const brand =
                product.brand ||
                product.brandName ||
                productDetails.brand ||
                productDetails.brandName ||
                "브랜드 정보 없음";
              const priceValue =
                product.price ??
                product.productPrice ??
                productDetails.price ??
                productDetails.productPrice;
              const price =
                priceValue == null
                  ? "가격 정보 없음"
                  : `${Number(priceValue).toLocaleString()}원`;
              const subcategory =
                product.subcategory ??
                productDetails.subcategory ??
                "상세 카테고리 정보 없음";
              const imageUrl =
                product.imageUrl ??
                product.thumbnailUrl ??
                product.image ??
                productDetails.imageUrl ??
                productDetails.thumbnailUrl ??
                productDetails.image;

              return (
                <article
                  key={productId}
                  className="group grid h-fit min-w-0 grid-rows-[auto_auto] self-start overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
                >
                  <div className="relative aspect-[5/4] shrink-0 overflow-hidden bg-slate-100">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={name}
                        className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-xs text-slate-400">
                        이미지 없음
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/55 to-transparent px-3 pb-3 pt-10">
                      <p className="max-h-10 overflow-hidden break-words text-sm font-bold leading-5 text-white drop-shadow-sm">
                        {name}
                      </p>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-col p-3">
                    <dl className="space-y-1 text-[11px]">
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <dt className="shrink-0 font-semibold text-slate-400">
                          브랜드
                        </dt>
                        <dd className="min-w-0 truncate text-right font-semibold text-slate-700">
                          {brand}
                        </dd>
                      </div>
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <dt className="shrink-0 font-semibold text-slate-400">
                          가격
                        </dt>
                        <dd className="min-w-0 truncate text-right font-bold text-slate-900">
                          {price}
                        </dd>
                      </div>
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <dt className="shrink-0 font-semibold text-slate-400">
                          상세 분류
                        </dt>
                        <dd className="min-w-0 truncate text-right font-semibold text-violet-600">
                          {subcategory}
                        </dd>
                      </div>
                    </dl>
                    <button
                      type="button"
                      onClick={() => onAdd(product)}
                      disabled={isAdding}
                      className="mt-2 w-full shrink-0 rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isAdding && String(addingProductId) === String(productId)
                        ? "추가 중..."
                        : "+ 후보에 추가"}
                    </button>
                  </div>
                </article>
              );
            })}
          {!productsQuery.isPending &&
            !productsQuery.isError &&
            filteredProducts.length === 0 && (
              <p className="col-span-full py-24 text-center text-sm text-slate-400">
                조건에 맞는 의상이 없습니다.
              </p>
            )}
        </div>

        <footer className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-sm text-slate-500">
          <span>총 {totalElements.toLocaleString()}개</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={currentPage === 0 || productsQuery.isFetching}
              className="rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-40"
            >
              이전
            </button>
            <span>{currentPage + 1} 페이지</span>
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={!hasNextPage || productsQuery.isFetching}
              className="rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-40"
            >
              다음
            </button>
          </div>
        </footer>
      </motion.section>
    </motion.div>
  );
}

export default ClothingAddModal;
