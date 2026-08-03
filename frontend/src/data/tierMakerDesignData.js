export const designRoomStatusResponse = {
  data: {
    roomId: 0,
    roomCode: "DESIGN",
    status: "IN_PROGRESS",
    version: 12,
    expiresAt: "2026-08-03T18:00:00Z",
    participants: [
      { participantId: 1, nickname: "디자이너", role: "HOST" },
      { participantId: 2, nickname: "스타일메이트", role: "GUEST" },
      { participantId: 3, nickname: "패션리더", role: "GUEST" },
    ],
    tiers: [
      { tierId: 1, name: "S", position: 0 },
      { tierId: 2, name: "A", position: 1 },
      { tierId: 3, name: "B", position: 2 },
      { tierId: 4, name: "C", position: 3 },
    ],
  },
};

export const designCandidatesResponse = {
  data: {
    items: [
      { roomItemId: 1001, productId: 101, tierId: 1, position: 10_000 },
      { roomItemId: 1002, productId: 102, tierId: 1, position: 20_000 },
      { roomItemId: 1003, productId: 103, tierId: 2, position: 10_000 },
      { roomItemId: 1004, productId: 104, tierId: null, position: 10_000 },
      { roomItemId: 1005, productId: 105, tierId: null, position: 20_000 },
      { roomItemId: 1006, productId: 106, tierId: null, position: 30_000 },
      { roomItemId: 1007, productId: 107, tierId: null, position: 40_000 },
      { roomItemId: 1008, productId: 108, tierId: null, position: 50_000 },
    ],
  },
};

export const designProductResponses = {
  101: { data: { productId: 101, name: "클래식 옥스퍼드 셔츠", brand: "GORDI", price: 59_000, currency: "KRW", category: "TOP", subcategory: "SHIRT", imageUrl: "" } },
  102: { data: { productId: 102, name: "소프트 케이블 니트", brand: "MELLOW", price: 79_000, currency: "KRW", category: "TOP", subcategory: "KNIT", imageUrl: "" } },
  103: { data: { productId: 103, name: "빈티지 데님 재킷", brand: "BLUE NOTE", price: 129_000, currency: "KRW", category: "OUTER", subcategory: "JACKET", imageUrl: "" } },
  104: { data: { productId: 104, name: "브라운 울 가디건", brand: "MELLOW", price: 98_000, currency: "KRW", category: "OUTER", subcategory: "CARDIGAN", imageUrl: "" } },
  105: { data: { productId: 105, name: "릴랙스드 와이드 팬츠", brand: "FORM", price: 69_000, currency: "KRW", category: "BOTTOM", subcategory: "WIDE_PANTS", imageUrl: "" } },
  106: { data: { productId: 106, name: "플리츠 미디 스커트", brand: "MUSE", price: 72_000, currency: "KRW", category: "BOTTOM", subcategory: "SKIRT", imageUrl: "" } },
  107: { data: { productId: 107, name: "화이트 코트 스니커즈", brand: "STEP", price: 89_000, currency: "KRW", category: "SHOES", subcategory: "SNEAKERS", imageUrl: "" } },
  108: { data: { productId: 108, name: "클래식 페니 로퍼", brand: "STEP", price: 119_000, currency: "KRW", category: "SHOES", subcategory: "LOAFER", imageUrl: "" } },
};
