"""Pydantic mirror of the Spring try-on generation contract.

Field names follow `TryOnGenerationRequest.java` (camelCase over the
wire); everything Spring may leave null is optional here so a contract
drift fails loudly at the field level, not with a 500.
"""

from __future__ import annotations

from decimal import Decimal

from pydantic import Field

from app.schemas.recommendation import CamelCaseModel


class TryOnContext(CamelCaseModel):
    type: str = Field(min_length=1)
    room_id: int | None = None
    board_version: int | None = None


class TryOnAvatar(CamelCaseModel):
    avatar_id: int = Field(gt=0)
    image_url: str = Field(min_length=1)
    gender: str | None = None
    body_type: str | None = None
    min_height: int | None = None
    max_height: int | None = None
    min_weight: int | None = None
    max_weight: int | None = None


class SizeProfile(CamelCaseModel):
    size_name: str | None = None
    total_length: Decimal | None = None
    shoulder_width: Decimal | None = None
    chest_width: Decimal | None = None
    sleeve_length: Decimal | None = None
    waist_width: Decimal | None = None
    hip_width: Decimal | None = None
    thigh_width: Decimal | None = None
    rise: Decimal | None = None


class TryOnItem(CamelCaseModel):
    product_id: int = Field(gt=0)
    slot: str = Field(min_length=1)
    image_url: str = Field(min_length=1)
    source: str | None = None
    description: str | None = None
    size_profile: SizeProfile | None = None


class WearOptions(CamelCaseModel):
    top_tuck: str | None = None
    outer_closure: str | None = None
    sleeves: str | None = None


class TryOnGenerationRequest(CamelCaseModel):
    job_id: int = Field(gt=0)
    context: TryOnContext
    avatar: TryOnAvatar
    items: list[TryOnItem] = Field(min_length=1, max_length=4)
    wear_options: WearOptions | None = None
    prompt: str | None = Field(default=None, max_length=2_000)


__all__ = [
    "SizeProfile",
    "TryOnAvatar",
    "TryOnContext",
    "TryOnGenerationRequest",
    "TryOnItem",
    "WearOptions",
]
