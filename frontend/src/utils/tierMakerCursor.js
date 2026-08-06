export const TIER_MAKER_CURSOR_ANCHOR_ATTRIBUTE =
  "data-tier-maker-cursor-anchor";
export const TIER_MAKER_CURSOR_ANCHOR_SELECTOR =
  `[${TIER_MAKER_CURSOR_ANCHOR_ATTRIBUTE}]`;

const RAW_COORDINATE_BASE = 2 ** 16;
const HASH_PART_BASE = 2 ** 14;
const LOCAL_COORDINATE_BASE = 2 ** 14;
const MAGIC_BASE = 2 ** 8;
const PACKED_COORDINATE_MAX = 2 ** 52 - 1;
const X_MAGIC = 0xa7;
const Y_MAGIC = 0x5d;

function clampCoordinate(value) {
  return Math.max(0, Math.min(1, value));
}

function quantize(value, base) {
  return Math.round(clampCoordinate(value) * (base - 1));
}

function hashAnchorKey(anchorKey) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < anchorKey.length; index += 1) {
    hash ^= anchorKey.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 4;
}

function packCoordinate({ raw, hashPart, local, magic }) {
  let packed = quantize(raw, RAW_COORDINATE_BASE);
  packed = packed * HASH_PART_BASE + hashPart;
  packed = packed * LOCAL_COORDINATE_BASE + quantize(local, LOCAL_COORDINATE_BASE);
  packed = packed * MAGIC_BASE + magic;

  return packed / PACKED_COORDINATE_MAX;
}

function unpackCoordinate(value) {
  if (!Number.isFinite(value)) return null;

  let packed = Math.round(clampCoordinate(value) * PACKED_COORDINATE_MAX);
  const magic = packed % MAGIC_BASE;
  packed = (packed - magic) / MAGIC_BASE;

  const local = packed % LOCAL_COORDINATE_BASE;
  packed = (packed - local) / LOCAL_COORDINATE_BASE;

  const hashPart = packed % HASH_PART_BASE;
  const raw = (packed - hashPart) / HASH_PART_BASE;

  return {
    magic,
    hashPart,
    local: local / (LOCAL_COORDINATE_BASE - 1),
    raw: raw / (RAW_COORDINATE_BASE - 1),
  };
}

export function createTierMakerCursorAnchorRegistry(boardElement) {
  const registry = new Map();

  if (!boardElement) return registry;

  const anchorElements = [
    ...(boardElement.matches(TIER_MAKER_CURSOR_ANCHOR_SELECTOR)
      ? [boardElement]
      : []),
    ...boardElement.querySelectorAll(TIER_MAKER_CURSOR_ANCHOR_SELECTOR),
  ];

  anchorElements.forEach((element) => {
    const anchorKey = element.getAttribute(
      TIER_MAKER_CURSOR_ANCHOR_ATTRIBUTE,
    );

    if (!anchorKey) return;

    const anchorHash = hashAnchorKey(anchorKey);

    if (registry.has(anchorHash)) {
      registry.set(anchorHash, null);
      return;
    }

    registry.set(anchorHash, {
      anchorKey,
      element,
    });
  });

  return registry;
}

export function findTierMakerCursorAnchor({
  target,
  boardElement,
  registry,
}) {
  let anchorElement =
    target instanceof Element
      ? target.closest(TIER_MAKER_CURSOR_ANCHOR_SELECTOR)
      : null;

  while (anchorElement && boardElement.contains(anchorElement)) {
    const anchorKey = anchorElement.getAttribute(
      TIER_MAKER_CURSOR_ANCHOR_ATTRIBUTE,
    );
    const entry = anchorKey ? registry.get(hashAnchorKey(anchorKey)) : null;

    if (entry?.element === anchorElement) {
      return {
        anchorElement,
        anchorKey,
      };
    }

    anchorElement = anchorElement.parentElement?.closest(
      TIER_MAKER_CURSOR_ANCHOR_SELECTOR,
    );
  }

  const boardAnchorKey = boardElement.getAttribute(
    TIER_MAKER_CURSOR_ANCHOR_ATTRIBUTE,
  );

  return boardAnchorKey
    ? {
        anchorElement: boardElement,
        anchorKey: boardAnchorKey,
      }
    : null;
}

export function encodeTierMakerCursor({
  rawX,
  rawY,
  localX,
  localY,
  anchorKey,
}) {
  const anchorHash = hashAnchorKey(anchorKey);
  const highHashPart = Math.floor(anchorHash / HASH_PART_BASE);
  const lowHashPart = anchorHash % HASH_PART_BASE;

  return {
    x: packCoordinate({
      raw: rawX,
      hashPart: highHashPart,
      local: localX,
      magic: X_MAGIC,
    }),
    y: packCoordinate({
      raw: rawY,
      hashPart: lowHashPart,
      local: localY,
      magic: Y_MAGIC,
    }),
  };
}

export function decodeTierMakerCursor(cursor) {
  const decodedX = unpackCoordinate(Number(cursor?.x));
  const decodedY = unpackCoordinate(Number(cursor?.y));

  if (!decodedX || !decodedY) return null;

  const rawPosition = {
    x: decodedX.raw,
    y: decodedY.raw,
  };

  if (decodedX.magic !== X_MAGIC || decodedY.magic !== Y_MAGIC) {
    return {
      isAnchored: false,
      rawPosition: {
        x: clampCoordinate(Number(cursor.x)),
        y: clampCoordinate(Number(cursor.y)),
      },
    };
  }

  return {
    isAnchored: true,
    anchorHash:
      decodedX.hashPart * HASH_PART_BASE + decodedY.hashPart,
    localPosition: {
      x: decodedX.local,
      y: decodedY.local,
    },
    rawPosition,
  };
}
