import type { EvaluationRoundNumber } from './routing'
import type {
  CandidateScore,
  EvaluationRun,
  IntegratedDashboard,
  DemoTestDataset,
  GarmentDraft,
  OperationsSummary,
  RevealResult,
  Round2AvatarInput,
  Round2TestDataset,
  Round2GarmentDraft,
  SetupInfo,
} from './types'

export const aiApiBaseUrl = (
  import.meta.env.VITE_IMAGE_DEMO_API_BASE_URL || 'http://127.0.0.1:8100'
).replace(/\/$/, '')

/** 서버는 ROUND_1 / ROUND_2 문자열을 받습니다. */
const roundParam = (round: EvaluationRoundNumber = 1) =>
  round === 2 ? 'ROUND_2' : 'ROUND_1'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${aiApiBaseUrl}${path}`, init)
  if (!response.ok) {
    let message = `요청에 실패했습니다. (${response.status})`
    try {
      const payload = await response.json()
      message = payload.detail || message
    } catch {
      // Keep the status-based message for non-JSON errors.
    }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export function mediaUrl(path: string): string {
  return path.startsWith('http') ? path : `${aiApiBaseUrl}${path}`
}

export async function getSetup(
  round: EvaluationRoundNumber = 1,
): Promise<SetupInfo> {
  const query = new URLSearchParams({ evaluation_round: roundParam(round) })
  return request(`/api/v1/evaluation/setup?${query}`)
}

export async function getDemoTestDataset(): Promise<DemoTestDataset> {
  return request('/test-data/musinsa/manifest.json')
}

export async function getRound2TestDataset(): Promise<Round2TestDataset> {
  return request('/test-data/musinsa/round2-manifest.json')
}

export async function imageFileFromDemoData(
  imageUrl: string,
  fileName: string,
): Promise<File> {
  const response = await fetch(mediaUrl(imageUrl))
  if (!response.ok) throw new Error(`샘플 이미지를 불러오지 못했습니다. (${response.status})`)
  const blob = await response.blob()
  return new File([blob], fileName, { type: blob.type || 'image/jpeg' })
}

export async function createRun(input: {
  scenarioName: string
  avatar: File
  garments: GarmentDraft[]
  mockMode: boolean
}): Promise<{ run_id: string; status: string }> {
  const form = new FormData()
  form.append('scenario_name', input.scenarioName)
  form.append('mock_mode', String(input.mockMode))
  form.append('avatar', input.avatar)
  form.append(
    'garment_metadata',
    JSON.stringify(
      input.garments.map((item) => ({
        slot: item.slot,
        caption: item.caption,
        fit_note: item.fitNote,
      })),
    ),
  )
  input.garments.forEach((item) => {
    if (item.file) form.append('garments', item.file)
  })
  return request('/api/v1/evaluation/runs', { method: 'POST', body: form })
}

export async function createRunRound2(input: {
  scenarioName: string
  avatar: File
  avatarInput: Round2AvatarInput
  garments: Round2GarmentDraft[]
  mockMode: boolean
}): Promise<{ run_id: string; status: string }> {
  const form = new FormData()
  form.append('scenario_name', input.scenarioName)
  form.append('mock_mode', String(input.mockMode))
  form.append('evaluation_round', '2')
  form.append('avatar_profile', JSON.stringify(input.avatarInput))
  form.append('avatar', input.avatar)
  form.append(
    'garment_metadata',
    JSON.stringify(
      input.garments.map((item) => ({
        slot: item.slot,
        caption: item.caption,
        fit_note: '',
        reference_type: item.referenceType,
        selected_size: item.selectedSize,
        measurements: item.measurements,
      })),
    ),
  )
  input.garments.forEach((item) => {
    if (item.file) form.append('garments', item.file)
  })
  return request('/api/v1/evaluation/runs', { method: 'POST', body: form })
}

export async function getRun(
  runId: string,
  evaluatorId: string,
): Promise<EvaluationRun> {
  const query = new URLSearchParams({ evaluator_id: evaluatorId })
  return request(`/api/v1/evaluation/runs/${runId}?${query}`)
}

export async function saveVote(input: {
  runId: string
  pairId: string
  evaluatorId: string
  winner: 'LEFT' | 'RIGHT' | 'TIE' | 'NEITHER'
  leftScores: CandidateScore
  rightScores: CandidateScore
  note: string
}): Promise<void> {
  await request(
    `/api/v1/evaluation/runs/${input.runId}/pairs/${input.pairId}/vote`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evaluator_id: input.evaluatorId,
        winner: input.winner,
        left_scores: input.leftScores,
        right_scores: input.rightScores,
        note: input.note,
      }),
    },
  )
}

export async function revealRun(runId: string): Promise<RevealResult> {
  return request(`/api/v1/evaluation/runs/${runId}/reveal`)
}

export async function getOperations(
  round: EvaluationRoundNumber = 1,
): Promise<OperationsSummary> {
  const query = new URLSearchParams({ evaluation_round: roundParam(round) })
  return request(`/api/v1/evaluation/operations?${query}`)
}

export async function getDashboard(
  evaluatorId: string,
  round: EvaluationRoundNumber = 1,
): Promise<IntegratedDashboard> {
  const query = new URLSearchParams({
    evaluator_id: evaluatorId,
    evaluation_round: roundParam(round),
  })
  return request(`/api/v1/evaluation/dashboard?${query}`)
}
