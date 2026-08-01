"""Musinsa product parser (goods-detail API + HTML fallback)."""

from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import urljoin

from garment_collector.models import (
    BackendCategory,
    BackendSubcategory,
    Gender,
    MeasurementBasis,
    MeasurementsCm,
    ParsedProduct,
    SaleStatus,
    SizeRow,
    Slot,
)

PRODUCT_URL_TEMPLATE = "https://www.musinsa.com/products/{product_id}"
DETAIL_API_TEMPLATE = "https://goods-detail.musinsa.com/api2/goods/{product_id}"
OPTIONS_API_TEMPLATE = (
    "https://goods-detail.musinsa.com/api2/goods/{product_id}/options"
)
ACTUAL_SIZE_API_TEMPLATE = (
    "https://goods-detail.musinsa.com/api2/goods/{product_id}/actual-size"
)
IMAGE_CDN = "https://image.msscdn.net"

# Korean measurement header → schema field
# Longer aliases must win when matching substrings.
_MEASUREMENT_ALIASES: dict[str, str] = {
    "총장": "total_length",
    "기장": "total_length",
    "어깨너비": "shoulder_width",
    "어깨": "shoulder_width",
    "가슴단면": "chest_width",
    "가슴": "chest_width",
    "허리단면": "waist_width",
    "허리": "waist_width",
    "엉덩이단면": "hip_width",
    "힙단면": "hip_width",
    "엉덩이": "hip_width",
    "허벅지단면": "thigh_width",
    "허벅지둘레": "thigh_width",
    "허벅지": "thigh_width",
    "소매길이": "sleeve_length",
    "소매기장": "sleeve_length",
    "소매": "sleeve_length",
    "밑위": "rise",
    "밑단단면": "hem_width",
    "밑단면": "hem_width",
    "밑단": "hem_width",
    "인심": "inseam",
}

# MVP excludes non-clothing (bags, watches, shoes, pure accessories, etc.).
# Match against category / full_path primarily to avoid name false positives
# ("캡 슬리브", "벨트 스커트").
_ACCESSORY_CATEGORY_KEYWORDS = (
    "가방",
    "백팩",
    "웨이스트",
    "크로스백",
    "토트백",
    "클러치",
    "서류가방",
    "지갑",
    "시계",
    "워치",
    "신발",
    "스니커즈",
    "부츠",
    "로퍼",
    "샌들",
    "슬리퍼",
    "구두",
    "모자",
    "캡/모자",
    "비니",
    "버킷햇",
    "양말",
    "속옷",
    "언더웨어",
    "이너웨어",
    "주얼리",
    "액세서리",
    "악세사리",
    "선글라스",
    "안경",
    "벨트",  # category only; clothing names handled via cat_blob
    "머플러",
    "스카프",
    "장갑",
    "디지털",
    "뷰티",
    "리빙",
    "가방/",
    "bag",
    "watch",
    "shoes",
    "sneakers",
    "eyewear",
    "jewelry",
    "accessory",
    "accessories",
    "wallet",
    "socks",
)
# Musinsa baseCategory prefixes that are not apparel (observed + common).
_NON_APPAREL_BASE_PREFIXES = (
    "004",  # bags
    "005",  # shoes (common storefront)
    "006",  # watches
    "007",  # accessories (common)
    "012",  # lifestyle/acc variants
    "017",
    "018",
    "020",  # beauty-ish
)

# Order matters only for outer/bottom/top general keywords.
# Skirt vs dress are handled first in classify_slot().
_SKIRT_KEYWORDS = (
    "스커트",
    "skirt",
    "스코츠",
    "skort",
    "pantskirt",
    "skirtpants",
    "미니스커트",
    "롱스커트",
)
_DRESS_AS_TOP_KEYWORDS = (
    "원피스",
    "드레스",
    "dress",
    "점프수트",
    "jumpsuit",
    "롬퍼",
    "romper",
    "오버롤",
)
_SLOT_KEYWORDS: list[tuple[Slot, tuple[str, ...]]] = [
    (
        Slot.OUTER,
        ("아우터", "자켓", "재킷", "코트", "점퍼", "패딩", "가디건", "outer"),
    ),
    (
        Slot.BOTTOM,
        (
            "팬츠",
            "바지",
            "슬랙스",
            "데님",
            "하의",
            "jeans",
            "pants",
            "숏팬츠",
            "쇼츠",
            "shorts",
        ),
    ),
    (
        Slot.TOP,
        (
            "상의",
            "티셔츠",
            "셔츠",
            "블라우스",
            "니트",
            "후드",
            "맨투맨",
            "top",
            "tee",
        ),
    ),
]

# Size label tokens commonly used in measurement lines
_SIZE_LABEL = (
    r"(?:XXS|XS|S|M|L|XL|XXL|XXXL|FREE|free|Free|"
    r"\d{2,3}|[2-7]\d|"
    r"이오|이공|사이즈)?"
)


def build_product_url(product_id: str) -> str:
    return PRODUCT_URL_TEMPLATE.format(product_id=product_id)


def build_detail_api_url(product_id: str) -> str:
    return DETAIL_API_TEMPLATE.format(product_id=product_id)


def build_options_api_url(product_id: str) -> str:
    return OPTIONS_API_TEMPLATE.format(product_id=product_id)


def build_actual_size_api_url(product_id: str) -> str:
    return ACTUAL_SIZE_API_TEMPLATE.format(product_id=product_id)


def parse_goods_detail_payload(
    product_id: str,
    product_url: str,
    payload: dict[str, Any],
    *,
    options_payload: dict[str, Any] | None = None,
    actual_size_payload: dict[str, Any] | None = None,
) -> ParsedProduct:
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    if not isinstance(data, dict):
        raise ValueError("goods-detail payload missing data object")

    name = _first_str(data.get("goodsNm"), data.get("goodsName"), data.get("name"))
    if not name:
        name = f"musinsa-{product_id}"

    brand = _first_str(
        _dig(data, ("brandInfo", "brandName")),
        data.get("brandName"),
        data.get("brand"),
    ) or "UNKNOWN"

    gender = _map_gender_from_detail(data)
    if gender == Gender.UNISEX:
        # fixture / legacy fields
        gender = _map_gender(
            _first_str(data.get("gender"), data.get("sex"), data.get("baseCategoryGender"))
        )
    category_raw = _first_str(
        _dig(data, ("category", "categoryDepth1Name")),
        _dig(data, ("category", "categoryDepth1Title")),
    ) or ""
    subcategory_raw = _first_str(
        _dig(data, ("category", "categoryDepth2Name")),
        _dig(data, ("category", "categoryDepth2Title")),
        data.get("baseCategoryFullPath"),
    ) or category_raw or "UNKNOWN"

    base_path = data.get("baseCategoryFullPath") or ""
    base_code = data.get("baseCategory")
    slot, note = classify_slot(
        category_raw,
        subcategory_raw,
        name,
        base_path,
    )
    is_set_product = any(
        token in name.upper()
        for token in ("[SET]", "(SET)", " 세트", "세트 ")
    )
    if is_set_product:
        note = (note + "; " if note else "") + "possible set product (manual exclude candidate)"

    excluded, exclude_reason = is_mvp_excluded(
        category_raw,
        subcategory_raw,
        name,
        base_path,
        base_category=base_code,
    )
    if excluded:
        note = (note + "; " if note else "") + (exclude_reason or "mvp excluded")

    price = _parse_price(
        _dig(data, ("goodsPrice", "salePrice"))
        or _dig(data, ("goodsPrice", "finalPrice"))
        or data.get("salePrice")
        or data.get("goodsPrice")
        or data.get("price")
        or data.get("discountPrice")
    )
    original_price = _parse_price(
        _dig(data, ("goodsPrice", "normalPrice"))
        or data.get("normalPrice")
        or data.get("originalPrice")
        or data.get("listPrice")
    )

    color_name = _first_str(
        data.get("color"),
        data.get("goodsColor"),
        data.get("colorName"),
        _guess_color_from_name(name),
    )
    image_urls = _extract_images_from_detail(data)
    backend_category, backend_subcategory = map_backend_codes(
        slot,
        category_raw,
        subcategory_raw,
        classification_note=note,
    )
    temporary_reasons: list[str] = []
    if backend_subcategory == BackendSubcategory.DRESS:
        temporary_reasons.append(
            "dress stored as TOP/DRESS by current backend contract"
        )
    if slot == Slot.OUTER:
        temporary_reasons.append(
            "outer stored as TOP by current backend contract"
        )
    if is_set_product:
        temporary_reasons.append(
            "set stored by first component pending manual split"
        )

    # Prefer official actual-size API (storefront size table).
    sizes = parse_actual_size_payload(actual_size_payload)
    if not sizes:
        sizes = parse_sizes_from_goods_contents(data.get("goodsContents") or "")
    if not sizes:
        sizes = _parse_size_table_field(data.get("sizeTable"))
    if not sizes and options_payload:
        sizes = _sizes_from_options_only(options_payload)

    material = None
    materials = _dig(data, ("goodsMaterial", "materials"))
    if isinstance(materials, list) and materials:
        material = ", ".join(str(x) for x in materials if x)

    return ParsedProduct(
        external_product_id=str(product_id),
        product_url=product_url,
        name=name,
        brand=brand,
        gender=gender,
        slot=slot,
        category=category_raw or "UNKNOWN",
        subcategory=subcategory_raw or "UNKNOWN",
        backend_category=backend_category,
        backend_subcategory=backend_subcategory,
        price_krw=price,
        original_price_krw=original_price,
        color_name=color_name,
        color_group=_normalize_color_group(color_name),
        material=material,
        description=_objective_description_from_contents(
            data.get("goodsContents") or "", name, color_name
        ),
        sale_status=_map_sale_status_detail(data),
        style_code=_first_str(data.get("styleNo"), data.get("styleCode")),
        style_group_id=_normalize_style_group_id(
            _first_str(
                data.get("similarNo"),
                data.get("headGoodsNo"),
                data.get("styleGroupId"),
            )
        ),
        image_urls=image_urls,
        sizes=sizes,
        raw_payload={
            "goods_detail": data,
            "options": options_payload,
            "actual_size": actual_size_payload,
        },
        classification_note=note,
        is_set_product=is_set_product,
        temporary_classification_reason=(
            "; ".join(temporary_reasons) if temporary_reasons else None
        ),
        excluded=excluded,
        exclude_reason=exclude_reason,
    )


def parse_actual_size_payload(
    payload: dict[str, Any] | None,
) -> list[SizeRow]:
    """Parse `/api2/goods/{id}/actual-size` storefront response."""
    if not payload:
        return []
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    if not isinstance(data, dict):
        return []
    sizes = data.get("sizes")
    if not isinstance(sizes, list) or not sizes:
        return []

    rows: list[SizeRow] = []
    for entry in sizes:
        if not isinstance(entry, dict):
            continue
        size_name = _first_str(entry.get("name"), entry.get("sizeName")) or "FREE"
        if size_name.upper() == "NONE":
            size_name = "FREE"
        measurements: dict[str, float | None] = {
            field: None for field in MeasurementsCm.model_fields
        }
        raw_values: dict[str, Any] = {}
        items = entry.get("items") or []
        if isinstance(items, list):
            for item in items:
                if not isinstance(item, dict):
                    continue
                label = _first_str(item.get("name"), item.get("label")) or ""
                value = item.get("value")
                raw_values[label] = value
                field = _map_measure_key(label)
                if field:
                    measurements[field] = _to_float_or_none(value)
        rows.append(
            SizeRow(
                size_name=size_name,
                measurement_basis=MeasurementBasis.FLAT_WIDTH,
                measurements_cm=MeasurementsCm(**measurements),
                raw_values=raw_values,
            )
        )
    return rows


def parse_musinsa_html(
    product_id: str, product_url: str, html: bytes
) -> ParsedProduct:
    """Fallback HTML parser (fixtures / when API is unavailable)."""
    text = html.decode("utf-8", errors="replace")
    embedded = _extract_embedded_json(text)
    if embedded:
        # Prefer pageProps.meta.data shape used by current storefront.
        for path in (
            ("props", "pageProps", "meta", "data"),
            ("props", "pageProps", "data"),
            ("props", "pageProps", "productData"),
        ):
            data = _dig(embedded, path)
            if isinstance(data, dict) and (
                data.get("goodsNo") or data.get("goodsNm") or data.get("productName")
            ):
                return parse_goods_detail_payload(
                    product_id,
                    product_url,
                    {"data": data},
                )
        try:
            return _parse_from_embedded_legacy(product_id, product_url, embedded)
        except Exception:
            pass
    return _parse_from_html_heuristics(product_id, product_url, text, embedded)


def parse_sizes_from_goods_contents(contents: str) -> list[SizeRow]:
    if not contents:
        return []

    text = re.sub(r"<br\s*/?>", "\n", contents, flags=re.I)
    text = re.sub(r"</p\s*>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)

    rows: list[SizeRow] = []
    # Pattern: "S 총장 103 cm 허리단면 36 cm ... M 총장 105 cm ..."
    # Body stops before the next size label + measurement keyword.
    measure_kw = r"총장|기장|어깨|가슴|허리|엉덩이|허벅지|소매|밑위|밑단|인심"
    size_label = r"XXS|XS|S|M|L|XL|XXL|XXXL|FREE|\d{2,3}"
    line_re = re.compile(
        rf"(?P<label>{size_label})\s+"
        rf"(?P<body>(?:{measure_kw}).*?)(?=(?:\s+(?:{size_label})\s+(?:{measure_kw}))|$)",
        flags=re.I | re.S,
    )
    for match in line_re.finditer(text):
        label = match.group("label").upper()
        body = match.group("body")
        # Ignore model height lines like "모델 166cm"
        if "모델" in body[:10]:
            continue
        measurements = _measurements_from_text(body)
        if any(v is not None for v in measurements.model_dump().values()):
            rows.append(
                SizeRow(
                    size_name=label,
                    measurement_basis=MeasurementBasis.FLAT_WIDTH,
                    measurements_cm=measurements,
                    raw_values={"line": match.group(0).strip()},
                )
            )

    if rows:
        return _dedupe_sizes(rows)

    # Fallback: free-form "총장 103 / 허리 36" without size labels → single FREE row
    if re.search(r"(총장|기장|가슴단면|허리단면).{0,10}\d+", text):
        measurements = _measurements_from_text(text)
        if any(v is not None for v in measurements.model_dump().values()):
            return [
                SizeRow(
                    size_name="FREE",
                    measurement_basis=MeasurementBasis.FLAT_WIDTH,
                    measurements_cm=measurements,
                    raw_values={"blob": text[:500]},
                )
            ]
    return []


def _measurements_from_text(text: str) -> MeasurementsCm:
    values: dict[str, float | None] = {
        field: None for field in MeasurementsCm.model_fields
    }
    # Prefer longer aliases first
    aliases = sorted(_MEASUREMENT_ALIASES.items(), key=lambda x: len(x[0]), reverse=True)
    for alias, field in aliases:
        if values[field] is not None:
            continue
        pattern = rf"{re.escape(alias)}\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:cm)?"
        match = re.search(pattern, text, flags=re.I)
        if match:
            values[field] = _to_float_or_none(match.group(1))
    return MeasurementsCm(**values)


def _dedupe_sizes(rows: list[SizeRow]) -> list[SizeRow]:
    seen: set[str] = set()
    out: list[SizeRow] = []
    for row in rows:
        if row.size_name in seen:
            continue
        seen.add(row.size_name)
        out.append(row)
    return out


def _parse_size_table_field(candidate: Any) -> list[SizeRow]:
    if not isinstance(candidate, list) or not candidate:
        return []
    rows: list[SizeRow] = []
    if all(isinstance(x, dict) for x in candidate):
        first = candidate[0]
        if any(
            k in first
            for k in ("sizeName", "size", "goodsSize", "size_nm", "name")
        ):
            for item in candidate:
                size_name = _first_str(
                    item.get("sizeName"),
                    item.get("size"),
                    item.get("goodsSize"),
                    item.get("size_nm"),
                    item.get("name"),
                ) or "FREE"
                measurements: dict[str, float | None] = {
                    field: None for field in MeasurementsCm.model_fields
                }
                raw_values: dict[str, Any] = {}
                for key, value in item.items():
                    raw_values[str(key)] = value
                    field = _map_measure_key(str(key))
                    if field:
                        measurements[field] = _to_float_or_none(value)
                rows.append(
                    SizeRow(
                        size_name=size_name,
                        measurement_basis=MeasurementBasis.FLAT_WIDTH,
                        measurements_cm=MeasurementsCm(**measurements),
                        raw_values=raw_values,
                    )
                )
    return rows


def _map_measure_key(key: str) -> str | None:
    k = key.strip().lower().replace(" ", "")
    if k in MeasurementsCm.model_fields:
        return k
    for alias, field in _MEASUREMENT_ALIASES.items():
        if alias in key:
            return field
    camel = {
        "totallength": "total_length",
        "shoulderwidth": "shoulder_width",
        "chestwidth": "chest_width",
        "waistwidth": "waist_width",
        "hipwidth": "hip_width",
        "thighwidth": "thigh_width",
        "sleevelength": "sleeve_length",
        "hemwidth": "hem_width",
    }
    return camel.get(k)


def _to_float_or_none(value: Any) -> float | None:
    """Normalize measurement numbers. Source zeros mean 'not provided' → null."""
    if value is None or isinstance(value, bool):
        return None
    number: float | None = None
    if isinstance(value, (int, float)):
        number = float(value)
    elif isinstance(value, str):
        text = value.strip()
        if not text or text in {"-", "상세 참조", "업체 문의", "FREE", "0", "0.0"}:
            return None
        match = re.search(r"(\d+(?:\.\d+)?)", text)
        if not match:
            return None
        number = float(match.group(1))
    if number is None:
        return None
    # 0 / negative are not valid garment measurements; keep raw elsewhere.
    if number <= 0:
        return None
    return number


def _sizes_from_options_only(options_payload: dict[str, Any]) -> list[SizeRow]:
    """When measurements are missing, still record size option names as empty rows."""
    data = options_payload.get("data") or {}
    basic = data.get("basic") or []
    names: list[str] = []
    for group in basic:
        if not isinstance(group, dict):
            continue
        if "사이즈" not in str(group.get("name", "")):
            continue
        for value in group.get("optionValues") or []:
            if isinstance(value, dict) and value.get("name"):
                names.append(str(value["name"]))
    return [
        SizeRow(
            size_name=name,
            measurement_basis=MeasurementBasis.UNKNOWN,
            measurements_cm=MeasurementsCm(),
            raw_values={"from": "options"},
        )
        for name in names
    ]


def _extract_images_from_detail(data: dict[str, Any]) -> list[str]:
    """Return only the storefront hero candidate for dataset v2."""
    candidates: list[str] = []

    def add(raw: Any) -> None:
        if not raw:
            return
        if isinstance(raw, dict):
            for key in ("url", "imageUrl", "src", "originUrl", "imgUrl"):
                if key in raw:
                    add(raw[key])
            return
        if not isinstance(raw, str):
            return
        url = _normalize_image_url(raw)
        if not url:
            return
        url = upgrade_goods_image_url(url)
        if url not in candidates:
            candidates.append(url)

    add(data.get("thumbnailImageUrl"))

    # Older payload fallback. Only the first structured gallery entry is kept.
    if not candidates:
        goods_images = data.get("goodsImages") or []
        if isinstance(goods_images, list) and goods_images:
            add(goods_images[0])
    return candidates[:1]


def upgrade_goods_image_url(url: str) -> str:
    """Normalize to Musinsa storefront hero cut (goods_img, w=1200).

    Product cards / PDP hero use:
      https://image.msscdn.net/thumbnails/images/goods_img/.../{id}_*_big.jpg?w=1200
    Direct `/images/goods_img/..._big.jpg` is often only 500px for older goods.
    """
    if "goods_img" not in url:
        return url
    # Strip host / thumbnail prefix / query → path under /images/goods_img/...
    path = url.strip()
    path = re.sub(r"^https?://image\.msscdn\.net", "", path)
    path = path.replace("/thumbnails/", "/")
    path = re.sub(r"\?.*$", "", path)
    if not path.startswith("/"):
        path = "/" + path.lstrip("/")
    # Normalize size token to _big
    path = re.sub(
        r"_(\d+)\.(jpg|jpeg|png|webp)$",
        r"_big.\2",
        path,
        flags=re.I,
    )
    if "/images/goods_img/" not in path:
        return url if url.startswith("http") else urljoin(IMAGE_CDN + "/", path.lstrip("/"))
    return f"{IMAGE_CDN}/thumbnails{path}?w=1200"


def _normalize_image_url(url: str) -> str | None:
    url = url.strip()
    if not url:
        return None
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("/images/") or url.startswith("/thumbnails/"):
        return urljoin(IMAGE_CDN + "/", url.lstrip("/"))
    if url.startswith("http://") or url.startswith("https://"):
        return url
    return None


def _objective_description_from_contents(
    contents: str, name: str, color_name: str | None
) -> str | None:
    """Keep a short objective description; avoid marketing fluff when possible."""
    parts: list[str] = []
    if color_name:
        parts.append(color_name)
    # Use product name tokens only (already objective enough for MVP).
    cleaned = re.sub(r"\[[^\]]*\]", "", name).strip()
    if cleaned:
        parts.append(cleaned)
    text = " ".join(parts).strip()
    return text or None


def _guess_color_from_name(name: str) -> str | None:
    # Trailing _GREY / _BLACK style tokens
    tail = re.search(
        r"[_/\-\s](BLACK|WHITE|GREY|GRAY|NAVY|BLUE|RED|GREEN|BEIGE|PINK|IVORY|"
        r"블랙|화이트|그레이|네이비|블루|레드|그린|베이지|핑크|아이보리)\s*$",
        name,
        flags=re.I,
    )
    if tail:
        return tail.group(1)

    brackets = re.findall(r"\[([^\]]+)\]", name)
    colorish = (
        "블랙",
        "화이트",
        "그레이",
        "네이비",
        "블루",
        "레드",
        "그린",
        "베이지",
        "핑크",
        "아이보리",
        "black",
        "white",
        "grey",
        "gray",
        "navy",
        "blue",
        "red",
        "green",
        "beige",
        "pink",
        "ivory",
    )
    for token in reversed(brackets):
        low = token.lower()
        if any(c in low for c in colorish):
            return token.strip()
    return None


def is_mvp_excluded(
    category: str,
    subcategory: str,
    name: str,
    full_path: str = "",
    *,
    base_category: Any = None,
) -> tuple[bool, str | None]:
    """Return whether product is out of MVP clothing scope (accessories etc.)."""
    cat_blob = f"{category} {subcategory} {full_path}".strip().lower()
    for kw in _ACCESSORY_CATEGORY_KEYWORDS:
        if kw.lower() in cat_blob:
            # "벨트" alone is risky if somehow in clothing path; require
            # non-apparel context or pure accessory category depth.
            if kw in {"벨트", "belt"} and any(
                cloth in cat_blob
                for cloth in ("의류", "상의", "바지", "스커트", "원피스", "아우터", "clothing")
            ):
                continue
            return True, f"mvp exclude accessory category '{kw}'"

    code = str(base_category).strip() if base_category is not None else ""
    if code and code.isdigit():
        for prefix in _NON_APPAREL_BASE_PREFIXES:
            if code.startswith(prefix):
                # Apparel paths usually start with 029 etc.; keep clothing.
                if any(
                    cloth in cat_blob
                    for cloth in (
                        "의류",
                        "상의",
                        "바지",
                        "스커트",
                        "원피스",
                        "아우터",
                        "clothing",
                        "스포츠웨어",
                    )
                ):
                    break
                return True, f"mvp exclude non-apparel baseCategory={code}"

    # Empty category + watch-like name tokens (e.g. Nixon watch with code 006xxx)
    name_l = (name or "").lower()
    if not cat_blob.strip() and code.startswith("006"):
        return True, f"mvp exclude watch baseCategory={code}"
    if not cat_blob.strip() and any(
        t in name_l for t in ("watch", "시계", "nixon", "casio", "g-shock")
    ):
        return True, "mvp exclude watch-like name without apparel category"

    return False, None


def classify_slot(
    category: str, subcategory: str, name: str, full_path: str = ""
) -> tuple[Slot, str | None]:
    """Map storefront labels to backend-aligned slots.

    Team rules (2026-07-30):
    - Skirt → BOTTOM (product_bottom_sizes / UI bottom)
    - One-piece / dress → TOP (no dress table; treat as single upper garment)
    """
    name_raw = name or ""
    name_l = name_raw.lower()
    # Multi-piece sets: classify by the first piece only (before '+').
    if "[set]" in name_l or "세트" in name_raw:
        primary = name_raw.split("+")[0]
        name_l = primary.lower()
        set_note = "set→first piece; "
    else:
        set_note = ""

    cat_l = f"{category} {subcategory} {full_path}".lower()
    # Avoid matching "shorts" inside set second piece via category blob alone.
    blob = f"{cat_l} {name_l}"

    has_skirt = any(k in blob for k in _SKIRT_KEYWORDS)
    has_dress = any(k in blob for k in _DRESS_AS_TOP_KEYWORDS)
    name_skirt = any(k in name_l for k in _SKIRT_KEYWORDS)
    name_dress = any(k in name_l for k in _DRESS_AS_TOP_KEYWORDS)

    # Name beats mixed category "원피스/스커트".
    if name_skirt and not name_dress:
        return Slot.BOTTOM, f"{set_note}skirt → BOTTOM"
    if name_dress and not name_skirt:
        return Slot.TOP, f"{set_note}dress/onepiece → TOP (team)"
    # Both or neither in name: prefer skirt when category mentions skirt.
    if has_skirt and not has_dress:
        return Slot.BOTTOM, f"{set_note}skirt category → BOTTOM"
    if has_dress and not has_skirt:
        return Slot.TOP, f"{set_note}dress category → TOP (team)"
    if has_skirt and has_dress:
        if name_skirt:
            return Slot.BOTTOM, f"{set_note}mixed label, skirt name → BOTTOM"
        return Slot.TOP, f"{set_note}mixed 원피스/스커트 → TOP (team dress default)"

    for slot, keywords in _SLOT_KEYWORDS:
        for kw in keywords:
            if kw.lower() in blob:
                return slot, f"{set_note}matched keyword '{kw}'"
    return Slot.TOP, f"{set_note}defaulted to TOP (no category keyword)"


def _normalize_category(slot: Slot, raw: str) -> str:
    if raw:
        return _slug(raw)
    return {
        Slot.TOP: "TOP",
        Slot.BOTTOM: "PANTS",
        Slot.OUTER: "OUTER",
        # Legacy enum kept for compatibility; new data should not land here.
        Slot.DRESS: "DRESS",
    }[slot]


def map_backend_codes(
    slot: Slot,
    category: str,
    subcategory: str,
    *,
    classification_note: str | None = None,
) -> tuple[BackendCategory, BackendSubcategory]:
    """Map preserved source labels to the backend enum contract."""
    blob = f"{category} {subcategory}".lower()
    note = (classification_note or "").lower()

    if slot == Slot.OUTER:
        # Team rule (2026-08-01): backend catalog stores TOP/BOTTOM only,
        # so outerwear lands in TOP with its outer subcategory preserved.
        backend_category = BackendCategory.TOP
        if any(token in blob for token in ("카디건", "가디건", "cardigan")):
            return backend_category, BackendSubcategory.CARDIGAN
        if any(token in blob for token in ("패딩", "다운", "padding")):
            return backend_category, BackendSubcategory.PADDING
        if any(token in blob for token in ("코트", "coat")):
            return backend_category, BackendSubcategory.COAT
        return backend_category, BackendSubcategory.JACKET

    if slot == Slot.BOTTOM:
        backend_category = BackendCategory.BOTTOM
        if "스커트" in blob:
            return backend_category, BackendSubcategory.SKIRT
        if any(token in blob for token in ("데님", "denim", "jean")):
            return backend_category, BackendSubcategory.DENIM_PANTS
        if any(token in blob for token in ("슈트", "슬랙스", "slacks")):
            return backend_category, BackendSubcategory.SLACKS
        if any(token in blob for token in ("숏", "쇼츠", "short")):
            return backend_category, BackendSubcategory.SHORTS
        if any(token in blob for token in ("코튼", "면바지", "cotton")):
            return backend_category, BackendSubcategory.COTTON_PANTS
        if any(token in blob for token in ("트레이닝", "조거", "jogger")):
            return backend_category, BackendSubcategory.JOGGER_PANTS
        if "스포츠/레저" in blob or "sports" in blob:
            return backend_category, BackendSubcategory.SPORTS_BOTTOM
        return backend_category, BackendSubcategory.OTHER_BOTTOM

    backend_category = BackendCategory.TOP
    if "dress" in note or any(
        token in blob for token in ("원피스", "드레스", "dress")
    ):
        return backend_category, BackendSubcategory.DRESS
    if any(token in blob for token in ("민소매", "슬리브리스", "sleeveless")):
        return backend_category, BackendSubcategory.SLEEVELESS
    if "스포츠/레저" in blob or "sports" in blob:
        return backend_category, BackendSubcategory.SPORTS_TOP
    if any(token in blob for token in ("반소매", "반팔", "short sleeve")):
        return backend_category, BackendSubcategory.SHORT_SLEEVE
    if any(token in blob for token in ("긴소매", "긴팔", "long sleeve")):
        return backend_category, BackendSubcategory.LONG_SLEEVE
    if any(token in blob for token in ("셔츠", "블라우스", "shirt", "blouse")):
        return backend_category, BackendSubcategory.SHIRT
    if any(token in blob for token in ("니트", "스웨터", "knit", "sweater")):
        return backend_category, BackendSubcategory.KNIT
    if any(token in blob for token in ("후드", "맨투맨", "hood", "sweatshirt")):
        return backend_category, BackendSubcategory.HOODIE
    return backend_category, BackendSubcategory.OTHER_TOP


def _slug(raw: str) -> str:
    token = raw.strip().upper().replace(" ", "_").replace(">", "_")
    token = re.sub(r"_+", "_", token)
    return token[:64] if token else "UNKNOWN"


def _normalize_color_group(color_name: str | None) -> str | None:
    if not color_name:
        return None
    c = color_name.lower()
    mapping = [
        ("BLACK", ("블랙", "검정", "black")),
        ("WHITE", ("화이트", "흰색", "white", "아이보리", "ivory")),
        ("GRAY", ("그레이", "회색", "gray", "grey", "차콜")),
        ("BLUE", ("블루", "청색", "blue", "네이비", "navy", "인디고")),
        ("RED", ("레드", "빨강", "red", "버건디")),
        ("GREEN", ("그린", "초록", "green", "카키", "khaki")),
        ("BEIGE", ("베이지", "beige", "크림", "cream", "브라운", "brown")),
        ("PINK", ("핑크", "pink")),
        ("PURPLE", ("퍼플", "보라", "purple", "lavender")),
        ("YELLOW", ("옐로", "노랑", "yellow", "mustard")),
        ("ORANGE", ("오렌지", "orange")),
    ]
    for group, keys in mapping:
        if any(k in c for k in keys):
            return group
    return "OTHER"


def _map_gender_from_detail(data: dict[str, Any]) -> Gender:
    genders = data.get("genders")
    if isinstance(genders, list) and genders:
        token = str(genders[0]).upper()
        if token in {"W", "F", "FEMALE"}:
            return Gender.FEMALE
        if token in {"M", "MALE"}:
            return Gender.MALE
        if token in {"U", "UNISEX", "A"}:
            return Gender.UNISEX
    sex = data.get("sex")
    if isinstance(sex, list) and sex:
        return _map_gender(str(sex[0]))
    return _map_gender(_first_str(data.get("gender"), data.get("sexCode")))


def _map_gender(raw: str | None) -> Gender:
    if raw is None:
        return Gender.UNISEX
    r = str(raw).lower()
    if r in {"f", "w", "female", "woman", "women", "여", "여성", "4"}:
        return Gender.FEMALE
    if r in {"m", "male", "man", "men", "남", "남성", "2"}:
        return Gender.MALE
    return Gender.UNISEX


def _map_sale_status_detail(data: dict[str, Any]) -> SaleStatus:
    if data.get("isOutOfStock") is True:
        return SaleStatus.SOLD_OUT
    if data.get("isSale") is True or data.get("goodsSaleType") == "SALE":
        return SaleStatus.ON_SALE
    if data.get("isSellPeriod") is False:
        return SaleStatus.DISCONTINUED
    return SaleStatus.UNKNOWN


def _parse_price(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        digits = re.sub(r"[^\d]", "", value)
        return int(digits) if digits else None
    return None


def _first_str(*values: Any) -> str | None:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return str(value)
    return None


def _normalize_style_group_id(value: str | None) -> str | None:
    if value is None:
        return None
    token = value.strip()
    return None if not token or token == "0" else token


def _dig(data: Any, path: tuple[str, ...]) -> Any:
    cur = data
    for key in path:
        if not isinstance(cur, dict) or key not in cur:
            return None
        cur = cur[key]
    return cur


def _extract_embedded_json(text: str) -> dict[str, Any] | None:
    m = re.search(
        r'<script[^>]+id="__NEXT_DATA__"[^>]*>(.*?)</script>',
        text,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass
    return None


def _parse_from_embedded_legacy(
    product_id: str, product_url: str, data: dict[str, Any]
) -> ParsedProduct:
    product_node = (
        _dig(data, ("props", "pageProps", "meta", "data"))
        or _dig(data, ("props", "pageProps", "productData"))
        or data
    )
    if not isinstance(product_node, dict):
        product_node = data
    return parse_goods_detail_payload(
        product_id, product_url, {"data": product_node}
    )


def _parse_from_html_heuristics(
    product_id: str,
    product_url: str,
    text: str,
    embedded: dict[str, Any] | None,
) -> ParsedProduct:
    title = None
    m = re.search(r"<title[^>]*>(.*?)</title>", text, flags=re.I | re.S)
    if m:
        title = re.sub(r"\s+", " ", m.group(1)).strip()
        title = title.split("|")[0].split("-")[0].strip() or None

    og_title = None
    m = re.search(
        r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\'](.*?)["\']',
        text,
        flags=re.I,
    )
    if m:
        og_title = m.group(1).strip()

    name = og_title or title or f"musinsa-{product_id}"
    brand = "UNKNOWN"
    m = re.search(
        r'<meta[^>]+property=["\']product:brand["\'][^>]+content=["\'](.*?)["\']',
        text,
        flags=re.I,
    )
    if m:
        brand = m.group(1).strip() or brand

    image_urls: list[str] = []
    for m in re.finditer(
        r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\'](.*?)["\']',
        text,
        flags=re.I,
    ):
        url = _normalize_image_url(m.group(1).strip())
        if url and url not in image_urls:
            image_urls.append(url)

    slot, note = classify_slot("", "", name)
    backend_category, backend_subcategory = map_backend_codes(
        slot, "", "", classification_note=note
    )
    return ParsedProduct(
        external_product_id=str(product_id),
        product_url=product_url,
        name=name,
        brand=brand,
        gender=Gender.UNISEX,
        slot=slot,
        category="UNKNOWN",
        subcategory="UNKNOWN",
        backend_category=backend_category,
        backend_subcategory=backend_subcategory,
        image_urls=image_urls,
        sizes=[],
        raw_payload={"embedded": embedded, "parser": "html-heuristics"},
        classification_note=note,
        sale_status=SaleStatus.UNKNOWN,
    )
