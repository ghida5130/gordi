from __future__ import annotations

from dataclasses import dataclass
from math import sqrt

from app.evaluation.models import AvatarInput, AvatarProfile


@dataclass(frozen=True)
class AvatarPreset:
    label: str
    gender: str
    body_type: str
    height_cm: float
    weight_kg: float
    shoulder_width_cm: float
    chest_circumference_cm: float
    waist_circumference_cm: float
    hip_circumference_cm: float
    arm_length_cm: float
    inseam_cm: float


AVATAR_PRESETS: dict[str, AvatarPreset] = {
    "female-rectangle": AvatarPreset(
        "여성 · 직선형", "FEMALE", "RECTANGLE",
        162, 54, 38, 84, 70, 88, 54, 74,
    ),
    "female-inverted-triangle": AvatarPreset(
        "여성 · 상체형", "FEMALE", "INVERTED_TRIANGLE",
        163, 55, 40, 88, 69, 87, 55, 75,
    ),
    "female-triangle": AvatarPreset(
        "여성 · 하체형", "FEMALE", "TRIANGLE",
        161, 56, 37, 84, 70, 94, 54, 73,
    ),
    "female-hourglass": AvatarPreset(
        "여성 · 모래시계형", "FEMALE", "HOURGLASS",
        163, 57, 38, 90, 68, 94, 55, 75,
    ),
    "female-oval": AvatarPreset(
        "여성 · 원형·볼륨형", "FEMALE", "OVAL",
        160, 64, 39, 94, 84, 96, 53, 72,
    ),
    "male-rectangle": AvatarPreset(
        "남성 · 직선형", "MALE", "RECTANGLE",
        173, 68, 44, 94, 82, 94, 59, 79,
    ),
    "male-inverted-triangle": AvatarPreset(
        "남성 · 상체형", "MALE", "INVERTED_TRIANGLE",
        175, 72, 48, 102, 82, 94, 61, 81,
    ),
    "male-triangle": AvatarPreset(
        "남성 · 하체형", "MALE", "TRIANGLE",
        172, 70, 43, 94, 84, 100, 58, 78,
    ),
    "male-hourglass": AvatarPreset(
        "남성 · 모래시계형", "MALE", "HOURGLASS",
        174, 71, 46, 100, 80, 96, 60, 80,
    ),
    "male-oval": AvatarPreset(
        "남성 · 원형·볼륨형", "MALE", "OVAL",
        171, 78, 45, 104, 96, 104, 58, 77,
    ),
}


def resolve_avatar_profile(avatar_input: AvatarInput) -> AvatarProfile:
    """Resolve non-user-facing fit measurements from an MVP avatar input.

    Length values scale with height. Circumferences use a volume proxy derived
    from relative weight and height. These are evaluation heuristics, not body
    scans or medical estimates.
    """

    try:
        preset = AVATAR_PRESETS[avatar_input.preset_id]
    except KeyError as exc:
        raise ValueError("Unknown avatar preset") from exc
    if avatar_input.gender != preset.gender:
        raise ValueError("Avatar preset does not match the selected gender")

    length_scale = avatar_input.height_cm / preset.height_cm
    circumference_scale = sqrt(
        (avatar_input.weight_kg / preset.weight_kg) / length_scale
    )
    shoulder_scale = (length_scale + circumference_scale) / 2

    def scaled(value: float, factor: float) -> float:
        return round(value * factor, 1)

    return AvatarProfile(
        preset_id=avatar_input.preset_id,
        label=preset.label,
        gender=avatar_input.gender,
        body_type=preset.body_type,
        height_cm=avatar_input.height_cm,
        weight_kg=avatar_input.weight_kg,
        shoulder_width_cm=scaled(preset.shoulder_width_cm, shoulder_scale),
        chest_circumference_cm=scaled(
            preset.chest_circumference_cm, circumference_scale
        ),
        waist_circumference_cm=scaled(
            preset.waist_circumference_cm, circumference_scale
        ),
        hip_circumference_cm=scaled(
            preset.hip_circumference_cm, circumference_scale
        ),
        arm_length_cm=scaled(preset.arm_length_cm, length_scale),
        inseam_cm=scaled(preset.inseam_cm, length_scale),
    )
