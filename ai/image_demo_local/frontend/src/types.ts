export type Slot = 'TOP' | 'BOTTOM' | 'OUTER' | 'DRESS'

export type ScoreKey =
  | 'garment_fidelity'
  | 'body_fidelity'
  | 'realism'
  | 'artifact_control'

export type CandidateScore = Record<ScoreKey, number>

export type GarmentReferenceType = 'product-only' | 'worn-reference'

export interface GarmentDraft {
  id: string
  file: File | null
  preview: string
  slot: Slot
  caption: string
  fitNote: string
  sourceUrl?: string
  referenceType?: GarmentReferenceType
}

export type Round2BodyGender = 'FEMALE' | 'MALE'

export interface Round2AvatarInput {
  preset_id: string
  gender: Round2BodyGender
  height_cm: number
  weight_kg: number
}

export interface Round2BodyProfile extends Round2AvatarInput {
  label: string
  body_type: string
  shoulder_width_cm: number
  chest_circumference_cm: number
  waist_circumference_cm: number
  hip_circumference_cm: number
  arm_length_cm: number
  inseam_cm: number
}

export type Round2GarmentMeasurementKey =
  | 'shoulder_width_cm'
  | 'chest_width_cm'
  | 'waist_width_cm'
  | 'hip_width_cm'
  | 'thigh_width_cm'
  | 'rise_cm'
  | 'inseam_cm'
  | 'sleeve_length_cm'
  | 'total_length_cm'
  | 'hem_width_cm'

export type Round2GarmentMeasurements = Partial<
  Record<Round2GarmentMeasurementKey, number>
>

export interface Round2GarmentDraft {
  id: string
  file: File | null
  preview: string
  slot: Slot
  caption: string
  referenceType: GarmentReferenceType
  selectedSize: string
  measurements: Round2GarmentMeasurements
}

export interface Round2DatasetGarment {
  product_id: string
  slot: Slot
  caption: string
  image_url: string
  source_url: string
  source_image_url: string
  reference_type: GarmentReferenceType
  model_present: boolean
  other_garments_present: boolean
  selected_size: string
  measurement_basis: 'flat-width' | 'circumference'
  measurements: Round2GarmentMeasurements
  image_sha256: string
}

export interface Round2DatasetCase {
  id: string
  axis: 'SIZE_SENSITIVITY' | 'REFERENCE_CONTAMINATION'
  name: string
  hypothesis: string
  avatar: Round2AvatarInput
  garment: Round2DatasetGarment
}

export interface Round2OutfitDatasetCase {
  id: string
  axis: 'OUTFIT_COMBINATION'
  name: string
  hypothesis: string
  avatar: Round2AvatarInput
  garments: Round2DatasetGarment[]
}

export interface Round2TestDataset {
  source: string
  collected_at: string
  usage_notice: string
  rights_status: string
  measurement_unit: 'cm'
  cases: Round2DatasetCase[]
  outfit_cases: Round2OutfitDatasetCase[]
}

export interface DemoGarmentPreset {
  product_id: string
  slot: Slot
  image_url: string
  file_name: string
  caption: string
  fit_tags: string[]
  source_url: string
  source_image_url: string
  reference_type: GarmentReferenceType
}

export interface DemoTestCasePreset {
  id: string
  name: string
  audience: string
  summary: string
  garments: DemoGarmentPreset[]
}

export interface DemoTestDataset {
  source: string
  collected_at: string
  usage_notice: string
  cases: DemoTestCasePreset[]
}

export interface BlindCandidate {
  candidate_id: string
  image_url: string
}

export interface Pair {
  pair_id: string
  left: BlindCandidate
  right: BlindCandidate
}

export interface EvaluationRun {
  run_id: string
  evaluation_round?: 1 | 2
  evaluation_profile?: string
  scenario_name: string
  status: 'QUEUED' | 'PROCESSING' | 'READY' | 'INSUFFICIENT_RESULTS'
  mock_mode: boolean
  created_at: string
  completed_at: string | null
  references: {
    avatar_url: string
    garments: Array<{
      image_url: string
      slot: Slot
      caption: string
      fit_note: string
      reference_type?: GarmentReferenceType
      selected_size?: string
      measurements?: Round2GarmentMeasurements
      fit_assessment?: {
        rule_version: string
        overall_fit: string
        length: string
        sleeve: string
        shoulder: string
        waist: string
        hip: string
        rise?: string
        leg_shape?: string
        summary_tags: string[]
        measurement_deltas_cm: Record<string, number>
        confidence: 'HIGH' | 'MEDIUM' | 'LOW'
      }
    }>
  }
  candidate_count: number
  pair_count: number
  team_vote_count: number
  voted_pair_ids: string[]
  pairs: Pair[]
}

export interface RankingItem {
  candidate_id: string
  provider_id: string
  display_name: string
  official_model: string
  input_strategy: string
  is_fallback: boolean
  wins: number
  ties: number
  losses: number
  neither: number
  preference_score: number
  quality_average: number
  quality_rating_count: number
  quality_dimensions: CandidateScore
  composite_score: number
  latency_ms: number | null
  cost_usd: number | null
}

export interface ProviderAttempt {
  provider_id: string
  model?: string
  status: string
  external_request_made?: boolean
  latency_ms?: number | null
  generation_time_ms?: number | null
  cost_usd?: number | null
  error_category?: string | null
  error_code?: string | null
  error: string | null
  retryable?: boolean
}

export interface TeamSummary {
  evaluator_count: number
  completed_evaluator_count: number
  pair_count: number
  submitted_votes: number
  possible_votes: number
  completion_rate: number
  participants: Array<{
    evaluator_id: string
    completed_pairs: number
    required_pairs: number
    completion_rate: number
    completed: boolean
  }>
}

export interface TimingSummary {
  average_ms: number | null
  median_ms: number | null
  p95_ms: number | null
}

export interface OperationsSummary {
  real_run_count: number
  actual_call_count: number
  success_count: number
  failure_count: number
  total_cost_usd: number
  providers: Array<{
    provider_id: string
    display_name: string
    model: string
    input_strategy: string
    is_fallback: boolean
    attempt_count: number
    actual_call_count: number
    success_count: number
    failure_count: number
    skipped_count: number
    success_rate: number | null
    latency: TimingSummary
    generation_time: TimingSummary
    cost: {
      known_success_count: number
      average_per_success_usd: number | null
      total_usd: number
    }
    error_categories: Record<string, number>
    skip_categories: Record<string, number>
    last_checked_at: string | null
  }>
}

export interface RevealResult {
  run_id: string
  mock_mode: boolean
  ranking: RankingItem[]
  best: RankingItem | null
  runner_up: RankingItem | null
  attempts: ProviderAttempt[]
  team_summary: TeamSummary
  operations: OperationsSummary
}

export interface DashboardRankingItem {
  provider_id: string
  display_name: string
  official_model: string
  input_strategy: string
  is_fallback: boolean
  case_count: number
  best_count: number
  wins: number
  ties: number
  losses: number
  neither: number
  preference_score: number
  quality_average: number
  quality_rating_count: number
  quality_dimensions: CandidateScore
  composite_score: number
}

export interface DashboardRunItem {
  run_id: string
  scenario_name: string
  status: EvaluationRun['status']
  created_at: string
  completed_at: string | null
  candidate_count: number
  pair_count: number
  team_vote_count: number
  team_evaluator_count: number
  evaluator_vote_count: number
  evaluator_required_vote_count: number
  evaluator_completed: boolean
  top_model: string | null
}

export interface SetupInfo {
  evaluation_round: 1 | 2
  evaluation_profile: string
  prompt_version: string
  commercial_candidate_count: number
  configured_commercial_count: number
  fallback_configured: boolean
  mock_mode_available: boolean
}

export interface IntegratedDashboard {
  evaluator_id: string
  evaluation_round: 1 | 2
  evaluation_profile: string
  completed_real_run_count: number
  real_run_count: number
  evaluated_run_count: number
  total_team_votes: number
  ranking: DashboardRankingItem[]
  runs: DashboardRunItem[]
  operations: OperationsSummary
  method: {
    preference_weight: number
    quality_weight: number
    mock_runs_excluded: boolean
    quality_average_weighted_by_rating_count: boolean
  }
}
