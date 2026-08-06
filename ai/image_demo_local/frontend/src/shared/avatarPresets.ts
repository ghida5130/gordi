import type { Round2BodyGender, Round2BodyProfile } from '../types'

/**
 * 1차·2차가 공유하는 선탑재 마네킹 10종.
 * `profile`은 2차 클라이언트 핏 미리보기 전용 기준값이며, 최종 핏 계산은 서버가 다시 수행합니다.
 */
export interface AvatarPreset {
  id: string
  genderLabel: '여성' | '남성'
  bodyTypeLabel: string
  fileName: string
  imageUrl: string
  profile: Round2BodyProfile
}

const avatarAssetUrl = (fileName: string) =>
  `${import.meta.env.BASE_URL}avatars/${fileName}`

export const avatarPresets: AvatarPreset[] = [
  {
    id: 'female-rectangle',
    genderLabel: '여성',
    bodyTypeLabel: '직선형',
    fileName: 'female-rectangle.png',
    imageUrl: avatarAssetUrl('female-rectangle.png'),
    profile: {
      preset_id: 'female-rectangle',
      label: '여성 · 직선형',
      gender: 'FEMALE',
      body_type: 'RECTANGLE',
      height_cm: 162,
      weight_kg: 54,
      shoulder_width_cm: 38,
      chest_circumference_cm: 84,
      waist_circumference_cm: 70,
      hip_circumference_cm: 88,
      arm_length_cm: 54,
      inseam_cm: 74,
    },
  },
  {
    id: 'female-inverted-triangle',
    genderLabel: '여성',
    bodyTypeLabel: '상체형',
    fileName: 'female-inverted-triangle.png',
    imageUrl: avatarAssetUrl('female-inverted-triangle.png'),
    profile: {
      preset_id: 'female-inverted-triangle',
      label: '여성 · 상체형',
      gender: 'FEMALE',
      body_type: 'INVERTED_TRIANGLE',
      height_cm: 163,
      weight_kg: 55,
      shoulder_width_cm: 40,
      chest_circumference_cm: 88,
      waist_circumference_cm: 69,
      hip_circumference_cm: 87,
      arm_length_cm: 55,
      inseam_cm: 75,
    },
  },
  {
    id: 'female-triangle',
    genderLabel: '여성',
    bodyTypeLabel: '하체형',
    fileName: 'female-triangle.png',
    imageUrl: avatarAssetUrl('female-triangle.png'),
    profile: {
      preset_id: 'female-triangle',
      label: '여성 · 하체형',
      gender: 'FEMALE',
      body_type: 'TRIANGLE',
      height_cm: 161,
      weight_kg: 56,
      shoulder_width_cm: 37,
      chest_circumference_cm: 84,
      waist_circumference_cm: 70,
      hip_circumference_cm: 94,
      arm_length_cm: 54,
      inseam_cm: 73,
    },
  },
  {
    id: 'female-hourglass',
    genderLabel: '여성',
    bodyTypeLabel: '모래시계형',
    fileName: 'female-hourglass.png',
    imageUrl: avatarAssetUrl('female-hourglass.png'),
    profile: {
      preset_id: 'female-hourglass',
      label: '여성 · 모래시계형',
      gender: 'FEMALE',
      body_type: 'HOURGLASS',
      height_cm: 163,
      weight_kg: 57,
      shoulder_width_cm: 38,
      chest_circumference_cm: 90,
      waist_circumference_cm: 68,
      hip_circumference_cm: 94,
      arm_length_cm: 55,
      inseam_cm: 75,
    },
  },
  {
    id: 'female-oval',
    genderLabel: '여성',
    bodyTypeLabel: '원형·볼륨형',
    fileName: 'female-oval.png',
    imageUrl: avatarAssetUrl('female-oval.png'),
    profile: {
      preset_id: 'female-oval',
      label: '여성 · 원형·볼륨형',
      gender: 'FEMALE',
      body_type: 'OVAL',
      height_cm: 160,
      weight_kg: 64,
      shoulder_width_cm: 39,
      chest_circumference_cm: 94,
      waist_circumference_cm: 84,
      hip_circumference_cm: 96,
      arm_length_cm: 53,
      inseam_cm: 72,
    },
  },
  {
    id: 'male-rectangle',
    genderLabel: '남성',
    bodyTypeLabel: '직선형',
    fileName: 'male-rectangle.png',
    imageUrl: avatarAssetUrl('male-rectangle.png'),
    profile: {
      preset_id: 'male-rectangle',
      label: '남성 · 직선형',
      gender: 'MALE',
      body_type: 'RECTANGLE',
      height_cm: 173,
      weight_kg: 68,
      shoulder_width_cm: 44,
      chest_circumference_cm: 94,
      waist_circumference_cm: 82,
      hip_circumference_cm: 94,
      arm_length_cm: 59,
      inseam_cm: 79,
    },
  },
  {
    id: 'male-inverted-triangle',
    genderLabel: '남성',
    bodyTypeLabel: '상체형',
    fileName: 'male-inverted-triangle.png',
    imageUrl: avatarAssetUrl('male-inverted-triangle.png'),
    profile: {
      preset_id: 'male-inverted-triangle',
      label: '남성 · 상체형',
      gender: 'MALE',
      body_type: 'INVERTED_TRIANGLE',
      height_cm: 175,
      weight_kg: 72,
      shoulder_width_cm: 48,
      chest_circumference_cm: 102,
      waist_circumference_cm: 82,
      hip_circumference_cm: 94,
      arm_length_cm: 61,
      inseam_cm: 81,
    },
  },
  {
    id: 'male-triangle',
    genderLabel: '남성',
    bodyTypeLabel: '하체형',
    fileName: 'male-triangle.png',
    imageUrl: avatarAssetUrl('male-triangle.png'),
    profile: {
      preset_id: 'male-triangle',
      label: '남성 · 하체형',
      gender: 'MALE',
      body_type: 'TRIANGLE',
      height_cm: 172,
      weight_kg: 70,
      shoulder_width_cm: 43,
      chest_circumference_cm: 94,
      waist_circumference_cm: 84,
      hip_circumference_cm: 100,
      arm_length_cm: 58,
      inseam_cm: 78,
    },
  },
  {
    id: 'male-hourglass',
    genderLabel: '남성',
    bodyTypeLabel: '모래시계형',
    fileName: 'male-hourglass.png',
    imageUrl: avatarAssetUrl('male-hourglass.png'),
    profile: {
      preset_id: 'male-hourglass',
      label: '남성 · 모래시계형',
      gender: 'MALE',
      body_type: 'HOURGLASS',
      height_cm: 174,
      weight_kg: 71,
      shoulder_width_cm: 46,
      chest_circumference_cm: 100,
      waist_circumference_cm: 80,
      hip_circumference_cm: 96,
      arm_length_cm: 60,
      inseam_cm: 80,
    },
  },
  {
    id: 'male-oval',
    genderLabel: '남성',
    bodyTypeLabel: '원형·볼륨형',
    fileName: 'male-oval.png',
    imageUrl: avatarAssetUrl('male-oval.png'),
    profile: {
      preset_id: 'male-oval',
      label: '남성 · 원형·볼륨형',
      gender: 'MALE',
      body_type: 'OVAL',
      height_cm: 171,
      weight_kg: 78,
      shoulder_width_cm: 45,
      chest_circumference_cm: 104,
      waist_circumference_cm: 96,
      hip_circumference_cm: 104,
      arm_length_cm: 58,
      inseam_cm: 77,
    },
  },
]

export const findAvatarPreset = (presetId: string) =>
  avatarPresets.find((preset) => preset.id === presetId)

export const avatarPresetsFor = (gender: Round2BodyGender) =>
  avatarPresets.filter((preset) => preset.profile.gender === gender)

/** 선탑재 아바타 이미지를 업로드 가능한 File로 변환합니다. */
export async function avatarPresetFile(preset: AvatarPreset): Promise<File> {
  const response = await fetch(preset.imageUrl)
  if (!response.ok) {
    throw new Error(`선탑재 아바타를 불러오지 못했습니다. (${response.status})`)
  }
  const blob = await response.blob()
  return new File([blob], preset.fileName, { type: blob.type || 'image/png' })
}
