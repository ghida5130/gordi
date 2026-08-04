export const tierMakerCategoryDetails = {
  TOP: {
    category: "top",
    categoryLabel: "상의",
    artwork: "shirt",
    color: "text-sky-300",
    surface: "bg-sky-50",
    fittingColor: "#7dd3fc",
  },
  OUTER: {
    category: "outer",
    categoryLabel: "아우터",
    artwork: "jacket",
    color: "text-slate-800",
    surface: "bg-slate-100",
    fittingColor: "#1e293b",
  },
  BOTTOM: {
    category: "bottom",
    categoryLabel: "하의",
    artwork: "pants",
    color: "text-blue-500",
    surface: "bg-blue-50",
    fittingColor: "#3b82f6",
  },
  SHOES: {
    category: "shoes",
    categoryLabel: "신발",
    artwork: "sneakers",
    color: "text-slate-100",
    surface: "bg-slate-200",
    fittingColor: "#f8fafc",
  },
};

const categoryAliases = {
  상의: "TOP",
  아우터: "OUTER",
  하의: "BOTTOM",
  신발: "SHOES",
};

const subcategoryAliases = {
  SHIRTS: "SHIRT",
  JEAN: "DENIM_PANTS",
  JEANS: "DENIM_PANTS",
};

export function normalizeTierMakerSubcategory(subcategory) {
  const normalized = String(subcategory ?? "").trim().toUpperCase();
  return subcategoryAliases[normalized] ?? normalized;
}

function normalizeCategory(category) {
  const normalized = String(category ?? "").toUpperCase();
  return tierMakerCategoryDetails[normalized]
    ? normalized
    : categoryAliases[category] ?? "TOP";
}

function resolveArtwork(subcategory, category) {
  const normalized = String(subcategory ?? "").toUpperCase();

  if (normalized.includes("CARDIGAN")) return "cardigan";
  if (normalized.includes("KNIT")) return "knit";
  if (normalized.includes("SHIRT")) return "shirt";
  if (normalized.includes("SKIRT")) return "skirt";
  if (normalized.includes("LOAFER")) return "loafers";
  if (normalized.includes("SNEAKER")) return "sneakers";

  return tierMakerCategoryDetails[category].artwork;
}

export function createTierMakerClothing(roomItem, product) {
  const category = normalizeCategory(roomItem.category ?? product?.category);
  const details = tierMakerCategoryDetails[category];
  const subcategory = roomItem.subcategory ?? product?.subcategory ?? "";

  return {
    id: String(roomItem.roomItemId),
    roomItemId: roomItem.roomItemId,
    productId: roomItem.productId,
    name: roomItem.name ?? product?.name ?? `상품 #${roomItem.productId}`,
    brand: roomItem.brand ?? product?.brand ?? "",
    price: roomItem.price ?? product?.price ?? null,
    imageUrl: roomItem.imageUrl ?? product?.imageUrl ?? "",
    subcategory,
    slot: category,
    ...details,
    artwork: resolveArtwork(subcategory, category),
  };
}
