from __future__ import annotations

from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


GarmentSlot = Literal["TOP", "BOTTOM", "OUTER", "DRESS"]
Winner = Literal["LEFT", "RIGHT", "TIE", "NEITHER"]
EvaluationRound = Literal["ROUND_1", "ROUND_2"]
ReferenceType = Literal["product-only", "worn-reference"]


class AvatarInput(BaseModel):
    """MVP body input supplied by the client for a prebuilt avatar."""

    model_config = ConfigDict(extra="forbid")

    preset_id: str = Field(min_length=1, max_length=120)
    gender: Literal["FEMALE", "MALE"]
    height_cm: float = Field(ge=120, le=220)
    weight_kg: float = Field(ge=30, le=200)

    @field_validator("preset_id")
    @classmethod
    def normalize_preset_id(cls, value: str) -> str:
        return " ".join(value.split())


class AvatarProfile(BaseModel):
    """Canonical body measurements attached to an avatar preset.

    Measurements are optional so a partially populated product catalog can still
    be exercised. Missing values produce UNKNOWN fit dimensions rather than
    guessed values.
    """

    preset_id: str = Field(min_length=1, max_length=120)
    label: str = Field(default="", max_length=120)
    gender: Literal["FEMALE", "MALE"] | None = None
    body_type: str = Field(default="", max_length=80)
    body_build: str = Field(default="", max_length=80)
    height_cm: float | None = Field(default=None, ge=100, le=250)
    weight_kg: float | None = Field(default=None, ge=25, le=300)
    shoulder_width_cm: float | None = Field(default=None, ge=20, le=80)
    chest_circumference_cm: float | None = Field(default=None, ge=40, le=220)
    waist_circumference_cm: float | None = Field(default=None, ge=35, le=220)
    hip_circumference_cm: float | None = Field(default=None, ge=40, le=240)
    arm_length_cm: float | None = Field(default=None, ge=25, le=100)
    inseam_cm: float | None = Field(default=None, ge=35, le=130)

    @field_validator("preset_id", "label", "body_type", "body_build")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return " ".join(value.split())


class GarmentMeasurements(BaseModel):
    """Selected-size garment measurements in centimeters.

    Width fields are explicitly flat/laid-flat widths. Fit calculation converts
    them to approximate circumferences exactly once.
    """

    total_length_cm: float | None = Field(default=None, gt=0, le=250)
    shoulder_width_cm: float | None = Field(default=None, gt=0, le=120)
    chest_width_cm: float | None = Field(
        default=None,
        gt=0,
        le=150,
        validation_alias=AliasChoices("chest_width_cm", "chest_flat_cm"),
    )
    waist_width_cm: float | None = Field(
        default=None,
        gt=0,
        le=150,
        validation_alias=AliasChoices("waist_width_cm", "waist_flat_cm"),
    )
    hip_width_cm: float | None = Field(
        default=None,
        gt=0,
        le=160,
        validation_alias=AliasChoices("hip_width_cm", "hip_flat_cm"),
    )
    thigh_width_cm: float | None = Field(default=None, gt=0, le=100)
    sleeve_length_cm: float | None = Field(default=None, gt=0, le=150)
    inseam_cm: float | None = Field(default=None, gt=0, le=150)
    rise_cm: float | None = Field(default=None, gt=0, le=80)
    hem_width_cm: float | None = Field(default=None, gt=0, le=120)


class FitAssessment(BaseModel):
    rule_version: str
    overall_fit: str = "UNKNOWN"
    length: str = "UNKNOWN"
    sleeve: str = "UNKNOWN"
    shoulder: str = "UNKNOWN"
    waist: str = "UNKNOWN"
    hip: str = "UNKNOWN"
    rise: str = "UNKNOWN"
    leg_shape: str = "UNKNOWN"
    summary_tags: list[str] = Field(default_factory=list, max_length=8)
    measurement_deltas_cm: dict[str, float] = Field(default_factory=dict)
    confidence: Literal["HIGH", "MEDIUM", "LOW"] = "LOW"


class GarmentMetadata(BaseModel):
    slot: GarmentSlot
    caption: str = Field(min_length=1, max_length=500)
    fit_note: str = Field(default="", max_length=300)
    reference_type: ReferenceType = "product-only"
    category: str = Field(default="", max_length=80)
    selected_size: str = Field(default="", max_length=40)
    measurements: GarmentMeasurements | None = None
    fit_assessment: FitAssessment | None = None

    @field_validator("caption", "fit_note", "category", "selected_size")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return " ".join(value.split())


class CandidateScore(BaseModel):
    garment_fidelity: int = Field(ge=1, le=5)
    body_fidelity: int = Field(ge=1, le=5)
    realism: int = Field(ge=1, le=5)
    artifact_control: int = Field(ge=1, le=5)


class VoteRequest(BaseModel):
    evaluator_id: str = Field(min_length=1, max_length=80)
    winner: Winner
    left_scores: CandidateScore
    right_scores: CandidateScore
    note: str = Field(default="", max_length=500)

    @field_validator("evaluator_id", "note")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return " ".join(value.split())
