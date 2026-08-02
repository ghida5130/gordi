"""Normalized garment JSON models (schema garment-dataset-v2)."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class Gender(str, Enum):
    FEMALE = "FEMALE"
    MALE = "MALE"
    UNISEX = "UNISEX"


class Slot(str, Enum):
    TOP = "TOP"
    BOTTOM = "BOTTOM"
    OUTER = "OUTER"
    DRESS = "DRESS"


class BackendCategory(str, Enum):
    TOP = "TOP"
    BOTTOM = "BOTTOM"
    OUTER = "OUTER"
    SHOES = "SHOES"


class BackendSubcategory(str, Enum):
    SHORT_SLEEVE = "SHORT_SLEEVE"
    LONG_SLEEVE = "LONG_SLEEVE"
    SHIRT = "SHIRT"
    KNIT = "KNIT"
    HOODIE = "HOODIE"
    SLEEVELESS = "SLEEVELESS"
    SPORTS_TOP = "SPORTS_TOP"
    OTHER_TOP = "OTHER_TOP"
    DRESS = "DRESS"
    DENIM_PANTS = "DENIM_PANTS"
    SLACKS = "SLACKS"
    SHORTS = "SHORTS"
    SKIRT = "SKIRT"
    COTTON_PANTS = "COTTON_PANTS"
    JOGGER_PANTS = "JOGGER_PANTS"
    SPORTS_BOTTOM = "SPORTS_BOTTOM"
    OTHER_BOTTOM = "OTHER_BOTTOM"
    JACKET = "JACKET"
    COAT = "COAT"
    CARDIGAN = "CARDIGAN"
    PADDING = "PADDING"
    SNEAKERS = "SNEAKERS"
    BOOTS = "BOOTS"
    LOAFER = "LOAFER"
    SANDALS = "SANDALS"


class ImageRole(str, Enum):
    PRIMARY = "PRIMARY"
    ALTERNATE = "ALTERNATE"
    DETAIL = "DETAIL"


class ImageView(str, Enum):
    FRONT = "FRONT"
    BACK = "BACK"
    SIDE = "SIDE"
    DETAIL = "DETAIL"
    UNKNOWN = "UNKNOWN"


class ReferenceType(str, Enum):
    UNKNOWN = "unknown"
    PRODUCT_ONLY = "product-only"
    WORN_REFERENCE = "worn-reference"


class SaleStatus(str, Enum):
    ON_SALE = "ON_SALE"
    SOLD_OUT = "SOLD_OUT"
    DISCONTINUED = "DISCONTINUED"
    UNKNOWN = "UNKNOWN"


class ValidationStatus(str, Enum):
    RAW = "RAW"
    INVALID = "INVALID"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    VALIDATED = "VALIDATED"
    READY = "READY"
    REJECTED = "REJECTED"


class MeasurementBasis(str, Enum):
    FLAT_WIDTH = "flat-width"
    CIRCUMFERENCE = "circumference"
    MIXED = "mixed"
    UNKNOWN = "unknown"


class SourceMeta(BaseModel):
    name: str
    external_product_id: str
    product_url: str
    collection_method: str
    collector_name: str
    collector_version: str
    collected_at: datetime
    last_seen_at: datetime
    rights_status: str
    policy_exception: str | None = None
    robots_txt_note: str | None = None
    # SHA-256 of canonical UTF-8 JSON bytes for raw/<source>/<id>/source.json.
    raw_bundle_sha256: str


class ProductMeta(BaseModel):
    name: str
    brand: str
    style_code: str | None = None
    style_group_id: str | None = None
    price_krw: int | None = None
    original_price_krw: int | None = None
    currency: str = "KRW"
    gender: Gender
    slot: Slot
    # Source labels are kept verbatim for traceability.
    category: str
    subcategory: str
    backend_category: BackendCategory
    backend_subcategory: BackendSubcategory
    color_name: str | None = None
    color_group: str | None = None
    season: str | None = None
    material: str | None = None
    description: str | None = None
    sale_status: SaleStatus = SaleStatus.UNKNOWN
    classification_note: str | None = None
    is_set_product: bool = False
    temporary_classification_reason: str | None = None


class ImageMeta(BaseModel):
    local_path: str
    source_url: str
    role: ImageRole
    view: ImageView = ImageView.UNKNOWN
    reference_type: ReferenceType = ReferenceType.UNKNOWN
    model_present: bool | None = None
    other_garments_present: bool | None = None
    width: int
    height: int
    mime_type: str
    byte_size: int
    sha256: str


class MeasurementsCm(BaseModel):
    total_length: float | None = None
    shoulder_width: float | None = None
    chest_width: float | None = None
    waist_width: float | None = None
    hip_width: float | None = None
    thigh_width: float | None = None
    sleeve_length: float | None = None
    rise: float | None = None
    inseam: float | None = None
    hem_width: float | None = None


class SizeRow(BaseModel):
    size_name: str
    measurement_basis: MeasurementBasis = MeasurementBasis.UNKNOWN
    measurements_cm: MeasurementsCm
    raw_values: dict[str, Any] | None = None


class ValidationInfo(BaseModel):
    status: ValidationStatus = ValidationStatus.RAW
    validated_at: datetime | None = None
    reviewer: str | None = None
    warnings: list[str] = Field(default_factory=list)


class GarmentRecord(BaseModel):
    schema_version: str
    source: SourceMeta
    product: ProductMeta
    images: list[ImageMeta] = Field(default_factory=list)
    sizes: list[SizeRow] = Field(default_factory=list)
    validation: ValidationInfo = Field(default_factory=ValidationInfo)


class ParsedProduct(BaseModel):
    """Adapter output before image download / validation."""

    external_product_id: str
    product_url: str
    name: str
    brand: str
    gender: Gender
    slot: Slot
    category: str
    subcategory: str
    backend_category: BackendCategory
    backend_subcategory: BackendSubcategory
    price_krw: int | None = None
    original_price_krw: int | None = None
    color_name: str | None = None
    color_group: str | None = None
    material: str | None = None
    description: str | None = None
    sale_status: SaleStatus = SaleStatus.UNKNOWN
    style_code: str | None = None
    style_group_id: str | None = None
    image_urls: list[str] = Field(default_factory=list)
    sizes: list[SizeRow] = Field(default_factory=list)
    raw_payload: dict[str, Any] = Field(default_factory=dict)
    classification_note: str | None = None
    is_set_product: bool = False
    temporary_classification_reason: str | None = None
    excluded: bool = False
    exclude_reason: str | None = None
