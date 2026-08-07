import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { searchProducts } from "@/api/products";
import { getApiErrorMessage } from "@/utils/apiError";

const categoryLabels = {
  ALL: "전체",
  OUTER: "아우터/코트",
  TOP: "상의",
  BOTTOM: "하의",
  ONE_PIECE: "원피스/세트",
  SHOES: "신발",
  BAG: "가방/액세서리",
};

function ClothingAddModal({ roomToken, onClose, onAdd }) {
  const [category, setCategory] = useState("ALL");
  const [keyword, setKeyword] = useState("");
  const productsQuery = useQuery({
    queryKey: ["products", roomToken, category, keyword],
    queryFn: () => searchProducts({
      roomToken,
      params: {
        category: category === "ALL" ? undefined : category,
        keyword: keyword.trim() || undefined,
        page: 0,
        size: 30,
      },
    }),
    enabled: Boolean(roomToken),
  });
  const products = productsQuery.data?.data?.products ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#202421]/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="의상 추가"
    >
      <section className="flex h-[min(720px,calc(100vh-2rem))] w-full max-w-5xl overflow-hidden rounded-[24px] border border-white/50 bg-[#FAFAF7] shadow-[0_32px_90px_rgba(20,24,21,0.28)]">
        <div className="flex min-w-0 flex-1 flex-col p-6">
          <div className="flex items-start justify-between gap-4 border-b border-[#E3E5E0] pb-5">
            <div>
              <span className="mb-2 inline-flex rounded-full bg-[#EDEAF8] px-3 py-1 text-[10px] font-black tracking-[0.12em] text-[#6655BA]">
                CLOTHING LIBRARY
              </span>
              <h2 className="text-xl font-bold tracking-[-0.025em] text-[#282D29]">
                의상 추가
              </h2>
              <p className="mt-1 text-sm font-medium text-[#8A908A]">
                카테고리와 상품명으로 원하는 의상을 찾아보세요.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-10 place-items-center rounded-[14px] border border-[#DDE0DA] bg-white text-lg text-[#858B85] transition duration-200 hover:border-[#CFC6F4] hover:bg-[#F3F0FB] hover:text-[#5E50AD]"
              aria-label="닫기"
            >
              ×
            </button>
          </div>
          <div className="relative mt-5 flex gap-2">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-[#969C96]">
              ⌕
            </span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="브랜드명, 상품명으로 검색..."
              className="min-w-0 flex-1 rounded-[16px] border border-[#DDE0DA] bg-white py-3 pl-11 pr-4 text-sm text-[#303531] outline-none transition duration-200 placeholder:text-[#A0A5A0] focus:border-[#8D7BE8] focus:ring-4 focus:ring-[#D9CDF8]/45"
            />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {Object.entries(categoryLabels).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${category === value ? "border-[#242925] bg-[#242925] text-white shadow-[0_8px_18px_rgba(31,35,32,0.16)]" : "border-[#DDE0DA] bg-white text-[#6D746E] hover:-translate-y-0.5 hover:border-[#AFA2E8] hover:bg-[#FAF9FF]"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-5 grid min-h-0 flex-1 grid-cols-3 gap-3 overflow-y-auto pr-1">
            {!roomToken && (
              <p className="col-span-full rounded-[20px] border border-dashed border-[#D8DBD5] bg-white/60 py-20 text-center text-sm font-medium text-[#858B85]">
                방에 입장한 뒤 의상 DB를 검색할 수 있습니다.
              </p>
            )}
            {productsQuery.isPending && (
              <div className="col-span-full flex flex-col items-center py-20 text-sm font-medium text-[#858B85]">
                <span className="mb-4 block size-8 animate-spin rounded-full border-[3px] border-[#E7E4F6] border-t-[#6D5CCF]" />
                의상을 검색하는 중입니다.
              </div>
            )}
            {productsQuery.isError && (
              <p className="col-span-full rounded-[20px] border border-red-100 bg-red-50 py-20 text-center text-sm font-medium text-red-600">
                {getApiErrorMessage(
                  productsQuery.error,
                  "의상 검색에 실패했습니다.",
                )}
              </p>
            )}
            {products.map((clothing) => {
              const image = clothing.imageUrl ?? clothing.thumbnailUrl ?? clothing.image;
              const name = clothing.name ?? clothing.productName ?? "이름 없는 의상";
              const id = clothing.productId ?? clothing.id;
              return (
                <article
                  key={id}
                  className="group overflow-hidden rounded-[20px] border border-[#E0E2DD] bg-white shadow-[0_8px_22px_rgba(31,35,32,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-[#D3CCF2] hover:shadow-[0_18px_38px_rgba(31,35,32,0.1)]"
                >
                  <div className="aspect-square overflow-hidden bg-[#ECEDE9]">
                    {image && (
                      <img
                        src={image}
                        alt={name}
                        className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
                      />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-bold text-[#313632]">
                      {name}
                    </p>
                    <p className="mt-1 truncate text-[11px] font-semibold text-[#8B918B]">
                      {clothing.brand ?? "브랜드 정보 없음"}
                    </p>
                    <p className="mt-2 text-xs font-black text-[#3D433E]">
                      {clothing.price
                        ? `₩${Number(clothing.price).toLocaleString()}`
                        : "가격 정보 없음"}
                    </p>
                    <button
                      type="button"
                      onClick={() => onAdd(clothing)}
                      className="mt-3 w-full rounded-full bg-[#242925] py-2.5 text-xs font-semibold text-white transition duration-200 hover:bg-[#6958C8]"
                    >
                      의상에 추가
                    </button>
                  </div>
                </article>
              );
            })}
            {roomToken &&
              !productsQuery.isPending &&
              !productsQuery.isError &&
              !products.length && (
                <p className="col-span-full rounded-[20px] border border-dashed border-[#D8DBD5] bg-white/60 py-20 text-center text-sm font-medium text-[#858B85]">
                  조건에 맞는 의상이 없습니다.
                </p>
              )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default ClothingAddModal;
