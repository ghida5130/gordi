import type {
  Round2AvatarInput,
  Round2BodyProfile,
  Round2GarmentMeasurements,
  Slot,
} from '../types'

const round1 = (value: number) => Math.round(value * 10) / 10

export function resolveBodyPreview(
  base: Round2BodyProfile,
  input: Round2AvatarInput,
): Round2BodyProfile {
  const lengthScale = input.height_cm / base.height_cm
  const circumferenceScale = Math.sqrt(
    (input.weight_kg / base.weight_kg) / lengthScale,
  )
  const shoulderScale = (lengthScale + circumferenceScale) / 2

  return {
    ...base,
    ...input,
    shoulder_width_cm: round1(base.shoulder_width_cm * shoulderScale),
    chest_circumference_cm: round1(
      base.chest_circumference_cm * circumferenceScale,
    ),
    waist_circumference_cm: round1(
      base.waist_circumference_cm * circumferenceScale,
    ),
    hip_circumference_cm: round1(
      base.hip_circumference_cm * circumferenceScale,
    ),
    arm_length_cm: round1(base.arm_length_cm * lengthScale),
    inseam_cm: round1(base.inseam_cm * lengthScale),
  }
}

const unique = (items: string[]) => [...new Set(items)]

const upperFitFromEase = (ease: number) => {
  if (ease < 0) return '타이트핏'
  if (ease < 6) return '슬림핏'
  if (ease < 14) return '레귤러핏'
  if (ease < 24) return '릴랙스핏'
  return '오버핏'
}

const lowerFitFromEase = (ease: number) => {
  if (ease < 0) return '타이트핏'
  if (ease < 6) return '슬림핏'
  if (ease < 14) return '레귤러핏'
  if (ease < 24) return '릴랙스핏'
  return '오버핏'
}

const lengthTagForUpper = (length: number, height: number) => {
  const ratio = length / height
  if (ratio < 0.31) return '크롭기장'
  if (ratio < 0.39) return '허리선기장'
  if (ratio < 0.47) return '힙기장'
  return '롱기장'
}

const shoulderTag = (garmentShoulder: number, bodyShoulder: number) => {
  const difference = garmentShoulder - bodyShoulder
  if (difference < -1.5) return '좁은어깨'
  if (difference < 2) return '정렬숄더'
  if (difference < 6) return '드롭숄더'
  return '강한드롭숄더'
}

const sleeveTag = (length: number, armLength: number) => {
  const difference = length - armLength
  if (difference < -25) return '반소매'
  if (difference < -10) return '칠부소매'
  if (difference <= 3) return '손목기장'
  return '손목덮는소매'
}

const riseTag = (rise: number) => {
  if (rise < 24) return '로우라이즈'
  if (rise < 29) return '미드라이즈'
  return '하이라이즈'
}

const legLengthTag = (inseam: number, bodyInseam: number) => {
  const difference = inseam - bodyInseam
  if (difference < -7) return '크롭렝스'
  if (difference < -2) return '앵클기장'
  if (difference <= 3) return '풀렝스'
  return '롱렝스'
}

const totalLegLengthTag = (length: number, height: number) => {
  const ratio = length / height
  if (ratio < 0.5) return '크롭렝스'
  if (ratio < 0.56) return '앵클기장'
  if (ratio <= 0.62) return '풀렝스'
  return '롱렝스'
}

const legShapeTag = (thigh: number, hem: number) => {
  const ratio = hem / thigh
  if (ratio < 0.58) return '슬림테이퍼드'
  if (ratio < 0.72) return '테이퍼드'
  if (ratio < 0.9) return '스트레이트'
  return '와이드'
}

const optionalValue = (
  measurements: Round2GarmentMeasurements,
  key: keyof Round2GarmentMeasurements,
) => {
  const value = measurements[key]
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null
}

export function deriveFitPreview(
  slot: Slot,
  measurements: Round2GarmentMeasurements,
  body: Round2BodyProfile,
): string[] {
  const tags: string[] = []

  if (slot === 'TOP' || slot === 'OUTER' || slot === 'DRESS') {
    const chest = optionalValue(measurements, 'chest_width_cm')
    const shoulder = optionalValue(measurements, 'shoulder_width_cm')
    const sleeve = optionalValue(measurements, 'sleeve_length_cm')
    const totalLength = optionalValue(measurements, 'total_length_cm')

    if (chest) {
      tags.push(upperFitFromEase(chest * 2 - body.chest_circumference_cm))
    }
    if (shoulder) tags.push(shoulderTag(shoulder, body.shoulder_width_cm))
    if (sleeve) tags.push(sleeveTag(sleeve, body.arm_length_cm))
    if (totalLength) tags.push(lengthTagForUpper(totalLength, body.height_cm))
  }

  if (slot === 'BOTTOM') {
    const waist = optionalValue(measurements, 'waist_width_cm')
    const hip = optionalValue(measurements, 'hip_width_cm')
    const thigh = optionalValue(measurements, 'thigh_width_cm')
    const hem = optionalValue(measurements, 'hem_width_cm')
    const rise = optionalValue(measurements, 'rise_cm')
    const inseam = optionalValue(measurements, 'inseam_cm')
    const totalLength = optionalValue(measurements, 'total_length_cm')

    if (waist) {
      tags.push(lowerFitFromEase(waist * 2 - body.waist_circumference_cm))
    }
    if (hip) {
      tags.push(`힙 ${lowerFitFromEase(hip * 2 - body.hip_circumference_cm)}`)
    }
    if (thigh && hem) tags.push(legShapeTag(thigh, hem))
    if (rise) tags.push(riseTag(rise))
    if (inseam) {
      tags.push(legLengthTag(inseam, body.inseam_cm))
    } else if (totalLength) {
      tags.push(totalLegLengthTag(totalLength, body.height_cm))
    }
  }

  if (slot === 'DRESS') {
    const waist = optionalValue(measurements, 'waist_width_cm')
    const hip = optionalValue(measurements, 'hip_width_cm')
    if (waist) {
      tags.push(`허리 ${upperFitFromEase(waist * 2 - body.waist_circumference_cm)}`)
    }
    if (hip) {
      tags.push(`힙 ${upperFitFromEase(hip * 2 - body.hip_circumference_cm)}`)
    }
  }

  return unique(tags)
}
