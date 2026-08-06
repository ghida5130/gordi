from __future__ import annotations

from app.evaluation.models import (
    AvatarProfile,
    FitAssessment,
    GarmentMeasurements,
    GarmentMetadata,
)


FIT_RULE_VERSION = "relative-fit-v1"


def _round_delta(value: float) -> float:
    return round(value, 1)


def _upper_body_fit(ease_cm: float) -> str:
    if ease_cm < 0:
        return "TIGHT"
    if ease_cm < 6:
        return "FITTED"
    if ease_cm < 14:
        return "REGULAR"
    if ease_cm < 24:
        return "RELAXED"
    return "OVERSIZED"


def _lower_body_fit(ease_cm: float) -> str:
    if ease_cm < 0:
        return "TIGHT"
    if ease_cm < 6:
        return "FITTED"
    if ease_cm < 14:
        return "REGULAR"
    if ease_cm < 24:
        return "RELAXED"
    return "OVERSIZED"


def _shoulder_fit(delta_cm: float) -> str:
    if delta_cm < -1.5:
        return "NARROW"
    if delta_cm < 2:
        return "ALIGNED"
    if delta_cm < 6:
        return "DROPPED"
    return "STRONGLY_DROPPED"


def _sleeve_fit(delta_cm: float) -> str:
    if delta_cm < -25:
        return "SHORT"
    if delta_cm < -10:
        return "THREE_QUARTER"
    if delta_cm <= 3:
        return "AT_WRIST"
    return "BEYOND_WRIST"


def _top_length(length_cm: float, height_cm: float) -> str:
    ratio = length_cm / height_cm
    if ratio < 0.31:
        return "CROPPED"
    if ratio < 0.39:
        return "AT_WAIST"
    if ratio < 0.47:
        return "AT_HIP"
    return "COVERS_HIP"


def _bottom_length(inseam_delta_cm: float) -> str:
    if inseam_delta_cm < -7:
        return "CROPPED"
    if inseam_delta_cm < -2:
        return "ANKLE"
    if inseam_delta_cm <= 3:
        return "FULL_LENGTH"
    return "LONG"


def _bottom_total_length(length_cm: float, height_cm: float) -> str:
    ratio = length_cm / height_cm
    if ratio < 0.50:
        return "CROPPED"
    if ratio < 0.56:
        return "ANKLE"
    if ratio <= 0.62:
        return "FULL_LENGTH"
    return "LONG"


def _rise_fit(rise_cm: float) -> str:
    if rise_cm < 24:
        return "LOW_RISE"
    if rise_cm < 29:
        return "MID_RISE"
    return "HIGH_RISE"


def _leg_shape(thigh_width_cm: float, hem_width_cm: float) -> str:
    ratio = hem_width_cm / thigh_width_cm
    if ratio < 0.58:
        return "SLIM_TAPERED"
    if ratio < 0.72:
        return "TAPERED"
    if ratio < 0.90:
        return "STRAIGHT"
    return "WIDE"


def _known_tags(values: list[tuple[str, str]]) -> list[str]:
    return [f"{name}:{value}" for name, value in values if value != "UNKNOWN"]


def derive_fit_assessment(
    garment: GarmentMetadata,
    avatar: AvatarProfile | None,
) -> FitAssessment:
    """Derive deterministic, avatar-relative tags for one selected garment size."""

    measurements = garment.measurements or GarmentMeasurements()
    if avatar is None:
        return FitAssessment(rule_version=FIT_RULE_VERSION)

    deltas: dict[str, float] = {}
    overall = "UNKNOWN"
    shoulder = "UNKNOWN"
    sleeve = "UNKNOWN"
    length = "UNKNOWN"
    waist = "UNKNOWN"
    hip = "UNKNOWN"
    rise = "UNKNOWN"
    leg_shape = "UNKNOWN"

    if measurements.shoulder_width_cm and avatar.shoulder_width_cm:
        shoulder_delta = measurements.shoulder_width_cm - avatar.shoulder_width_cm
        deltas["shoulder"] = _round_delta(shoulder_delta)
        shoulder = _shoulder_fit(shoulder_delta)

    if measurements.sleeve_length_cm and avatar.arm_length_cm:
        sleeve_delta = measurements.sleeve_length_cm - avatar.arm_length_cm
        deltas["sleeve"] = _round_delta(sleeve_delta)
        sleeve = _sleeve_fit(sleeve_delta)

    if garment.slot in {"TOP", "OUTER", "DRESS"}:
        if measurements.chest_width_cm and avatar.chest_circumference_cm:
            chest_ease = measurements.chest_width_cm * 2 - avatar.chest_circumference_cm
            deltas["chest_ease"] = _round_delta(chest_ease)
            overall = _upper_body_fit(chest_ease)
        if measurements.waist_width_cm and avatar.waist_circumference_cm:
            waist_ease = measurements.waist_width_cm * 2 - avatar.waist_circumference_cm
            deltas["waist_ease"] = _round_delta(waist_ease)
            waist = _lower_body_fit(waist_ease)
        if measurements.hip_width_cm and avatar.hip_circumference_cm:
            hip_ease = measurements.hip_width_cm * 2 - avatar.hip_circumference_cm
            deltas["hip_ease"] = _round_delta(hip_ease)
            hip = _lower_body_fit(hip_ease)
        if measurements.total_length_cm and avatar.height_cm:
            length = _top_length(measurements.total_length_cm, avatar.height_cm)
    else:
        lower_fits = []
        if measurements.waist_width_cm and avatar.waist_circumference_cm:
            waist_ease = measurements.waist_width_cm * 2 - avatar.waist_circumference_cm
            deltas["waist_ease"] = _round_delta(waist_ease)
            waist = _lower_body_fit(waist_ease)
            lower_fits.append(waist)
        if measurements.hip_width_cm and avatar.hip_circumference_cm:
            hip_ease = measurements.hip_width_cm * 2 - avatar.hip_circumference_cm
            deltas["hip_ease"] = _round_delta(hip_ease)
            hip = _lower_body_fit(hip_ease)
            lower_fits.append(hip)
        if lower_fits:
            # The most restrictive measured area determines perceived lower-body fit.
            fit_order = {
                "TIGHT": 0,
                "FITTED": 1,
                "REGULAR": 2,
                "RELAXED": 3,
                "OVERSIZED": 4,
            }
            overall = min(lower_fits, key=lambda item: fit_order[item])
        if measurements.rise_cm:
            rise = _rise_fit(measurements.rise_cm)
        if measurements.thigh_width_cm and measurements.hem_width_cm:
            leg_shape = _leg_shape(
                measurements.thigh_width_cm,
                measurements.hem_width_cm,
            )
        if measurements.inseam_cm and avatar.inseam_cm:
            inseam_delta = measurements.inseam_cm - avatar.inseam_cm
            deltas["inseam"] = _round_delta(inseam_delta)
            length = _bottom_length(inseam_delta)
        elif measurements.total_length_cm and avatar.height_cm:
            length = _bottom_total_length(
                measurements.total_length_cm,
                avatar.height_cm,
            )

    tags = _known_tags(
        [
            ("overall", overall),
            ("shoulder", shoulder),
            ("sleeve", sleeve),
            ("length", length),
            ("waist", waist),
            ("hip", hip),
            ("rise", rise),
            ("leg_shape", leg_shape),
        ]
    )
    measured_dimension_count = len(tags)
    confidence = (
        "HIGH"
        if measured_dimension_count >= 4
        else "MEDIUM"
        if measured_dimension_count >= 2
        else "LOW"
    )
    return FitAssessment(
        rule_version=FIT_RULE_VERSION,
        overall_fit=overall,
        length=length,
        sleeve=sleeve,
        shoulder=shoulder,
        waist=waist,
        hip=hip,
        rise=rise,
        leg_shape=leg_shape,
        summary_tags=tags,
        measurement_deltas_cm=deltas,
        confidence=confidence,
    )


def resolve_garment_metadata(
    garments: list[GarmentMetadata],
    avatar: AvatarProfile | None,
) -> list[GarmentMetadata]:
    return [
        garment.model_copy(
            update={"fit_assessment": derive_fit_assessment(garment, avatar)}
        )
        for garment in garments
    ]
