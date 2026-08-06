import type { Round2GarmentMeasurementKey, Slot } from '../types'

export interface Round2Model {
  providerId: string
  displayName: string
  role: string
}

export interface MeasurementField {
  key: Round2GarmentMeasurementKey
  label: string
  hint: string
}

/** 1차 대시보드 상위 4개. 서버 ROUND_2_PROVIDER_IDS와 같은 순서를 유지합니다. */
export const round2Models: Round2Model[] = [
  {
    providerId: 'gpt_image_2',
    displayName: 'GPT Image 2',
    role: '1차 종합 1위',
  },
  {
    providerId: 'nano_banana_2_lite',
    displayName: 'Nano Banana 2 Lite',
    role: '1차 종합 2위',
  },
  {
    providerId: 'nano_banana_2',
    displayName: 'Nano Banana 2',
    role: '1차 종합 3위',
  },
  {
    providerId: 'flux_2_max',
    displayName: 'FLUX.2 Max',
    role: '1차 종합 4위',
  },
]

const upperFields: MeasurementField[] = [
  { key: 'shoulder_width_cm', label: '어깨너비', hint: '좌우 직선' },
  { key: 'chest_width_cm', label: '가슴단면', hint: '겨드랑이 아래' },
  { key: 'sleeve_length_cm', label: '소매길이', hint: '어깨선부터' },
  { key: 'total_length_cm', label: '총장', hint: '목점부터 밑단' },
]

export const measurementFieldsBySlot: Record<Slot, MeasurementField[]> = {
  TOP: upperFields,
  OUTER: upperFields,
  BOTTOM: [
    { key: 'total_length_cm', label: '총장', hint: '허리선부터 밑단' },
    { key: 'waist_width_cm', label: '허리단면', hint: '밴드 자연상태' },
    { key: 'hip_width_cm', label: '엉덩이단면', hint: '가장 넓은 지점' },
    { key: 'thigh_width_cm', label: '허벅지단면', hint: '밑위 아래' },
    { key: 'rise_cm', label: '밑위', hint: '앞 밑위 기준' },
    { key: 'inseam_cm', label: '인심', hint: '가랑이부터 밑단' },
    { key: 'hem_width_cm', label: '밑단단면', hint: '밑단 좌우' },
  ],
  DRESS: [
    { key: 'shoulder_width_cm', label: '어깨너비', hint: '좌우 직선' },
    { key: 'chest_width_cm', label: '가슴단면', hint: '겨드랑이 아래' },
    { key: 'waist_width_cm', label: '허리단면', hint: '허리선 기준' },
    { key: 'hip_width_cm', label: '엉덩이단면', hint: '가장 넓은 지점' },
    { key: 'sleeve_length_cm', label: '소매길이', hint: '어깨선부터' },
    { key: 'total_length_cm', label: '총장', hint: '목점부터 밑단' },
  ],
}
