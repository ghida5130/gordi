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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="의상 추가">
      <section className="flex h-[min(720px,calc(100vh-2rem))] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex min-w-0 flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">의상 추가</h2>
              <p className="mt-1 text-sm text-slate-400">카테고리와 상품명으로 원하는 의상을 찾아보세요.</p>
            </div>
            <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full border text-lg text-slate-400 hover:bg-slate-50" aria-label="닫기">×</button>
          </div>
          <div className="mt-5 flex gap-2">
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="브랜드명, 상품명으로 검색..." className="min-w-0 flex-1 rounded-xl border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white" />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {Object.entries(categoryLabels).map(([value, label]) => <button key={value} type="button" onClick={() => setCategory(value)} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${category === value ? "border-slate-900 bg-slate-900 text-white" : "text-slate-500 hover:border-slate-400"}`}>{label}</button>)}
          </div>
          <div className="mt-5 grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
            {!roomToken && <p className="col-span-full py-20 text-center text-sm text-slate-400">방에 입장한 뒤 의상 DB를 검색할 수 있습니다.</p>}
            {productsQuery.isPending && <p className="col-span-full py-20 text-center text-sm text-slate-400">의상을 검색하는 중입니다.</p>}
            {productsQuery.isError && <p className="col-span-full py-20 text-center text-sm text-red-600">{getApiErrorMessage(productsQuery.error, "의상 검색에 실패했습니다.")}</p>}
            {products.map((clothing) => {
              const image = clothing.imageUrl ?? clothing.thumbnailUrl ?? clothing.image;
              const name = clothing.name ?? clothing.productName ?? "이름 없는 의상";
              const id = clothing.productId ?? clothing.id;
              return <article key={id} className="overflow-hidden rounded-2xl border bg-white">
                <div className="aspect-square bg-slate-100">{image && <img src={image} alt={name} className="size-full object-cover" />}</div>
                <div className="p-3"><p className="truncate text-sm font-semibold">{name}</p><p className="mt-1 text-xs text-slate-500">{clothing.price ? `₩${Number(clothing.price).toLocaleString()}` : clothing.brand ?? ""}</p><button type="button" onClick={() => onAdd(clothing)} className="mt-3 w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-700">의상에 추가</button></div>
              </article>;
            })}
            {roomToken && !productsQuery.isPending && !productsQuery.isError && !products.length && <p className="col-span-full py-20 text-center text-sm text-slate-400">조건에 맞는 의상이 없습니다.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

export default ClothingAddModal;
