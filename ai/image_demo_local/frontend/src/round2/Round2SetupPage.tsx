import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import {
  createRunRound2,
  getRound2TestDataset,
  imageFileFromDemoData,
  mediaUrl,
} from '../api'
import { navigate, routeHref } from '../routing'
import type { AvatarPreset } from '../shared/avatarPresets'
import {
  avatarPresetFile,
  avatarPresetsFor,
  findAvatarPreset,
} from '../shared/avatarPresets'
import { slotLabels } from '../shared/constants'
import { readEvaluatorId } from '../shared/evaluator'
import type {
  Round2AvatarInput,
  Round2BodyGender,
  Round2DatasetCase,
  Round2GarmentDraft,
  Round2GarmentMeasurementKey,
  Round2OutfitDatasetCase,
  Round2TestDataset,
  Slot,
} from '../types'
import { deriveFitPreview, resolveBodyPreview } from './fitPreview'
import { measurementFieldsBySlot, round2Models } from './presets'
import './round2.css'

const bodyInputFields: Array<{
  key: 'height_cm' | 'weight_kg'
  label: string
  unit: string
  min: number
  max: number
}> = [
  { key: 'height_cm', label: '키', unit: 'cm', min: 120, max: 220 },
  { key: 'weight_kg', label: '몸무게', unit: 'kg', min: 30, max: 200 },
]

const requiredMeasurementsBySlot: Record<
  Slot,
  Round2GarmentMeasurementKey[]
> = {
  TOP: ['shoulder_width_cm', 'chest_width_cm', 'total_length_cm'],
  OUTER: ['shoulder_width_cm', 'chest_width_cm', 'total_length_cm'],
  BOTTOM: ['total_length_cm', 'waist_width_cm', 'hip_width_cm'],
  DRESS: [
    'chest_width_cm',
    'waist_width_cm',
    'hip_width_cm',
    'total_length_cm',
  ],
}

const imageMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])
const maxImageBytes = 10 * 1024 * 1024

const newGarment = (slot: Slot = 'TOP'): Round2GarmentDraft => ({
  id: crypto.randomUUID(),
  file: null,
  preview: '',
  slot,
  caption: '',
  referenceType: 'product-only',
  selectedSize: '',
  measurements: {},
})

const validateImage = (file: File) => {
  if (!imageMimeTypes.has(file.type)) {
    return 'PNG, JPEG, WebP 이미지만 사용할 수 있습니다.'
  }
  if (file.size > maxImageBytes) {
    return '이미지는 파일당 10MB 이하여야 합니다.'
  }
  return ''
}

type Round2PresetCase = Round2DatasetCase | Round2OutfitDatasetCase

const garmentsForCase = (testCase: Round2PresetCase) =>
  'garments' in testCase ? testCase.garments : [testCase.garment]

const datasetFileName = (
  garment: ReturnType<typeof garmentsForCase>[number],
) => {
  const extension = garment.image_url.toLowerCase().endsWith('.png')
    ? 'png'
    : 'jpg'
  return `round2-${garment.product_id}-${garment.selected_size}.${extension}`
}

function Round2SetupPage() {
  const [scenarioName, setScenarioName] = useState(
    '2차 · 동적 치수와 착용 레퍼런스 분리 검증',
  )
  const [mockMode, setMockMode] = useState(true)
  const [avatar, setAvatar] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [selectedAvatarPresetId, setSelectedAvatarPresetId] = useState('')
  const [avatarBusyId, setAvatarBusyId] = useState('')
  const [testDataset, setTestDataset] = useState<Round2TestDataset | null>(null)
  const [selectedDatasetCaseId, setSelectedDatasetCaseId] = useState('')
  const [avatarInput, setAvatarInput] = useState<Round2AvatarInput>({
    preset_id: '',
    gender: 'FEMALE',
    height_cm: 162,
    weight_kg: 54,
  })
  const [garments, setGarments] = useState<Round2GarmentDraft[]>([
    newGarment(),
  ])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getRound2TestDataset()
      .then(setTestDataset)
      .catch((reason) => {
        setError(`2차 테스트 데이터셋을 불러오지 못했습니다. ${(reason as Error).message}`)
      })
  }, [])

  const evaluatorId = readEvaluatorId() || '평가자 미지정'
  const personWornCount = garments.filter(
    (item) => item.referenceType === 'worn-reference',
  ).length
  const selectedAvatarPreset = findAvatarPreset(selectedAvatarPresetId)
  const visibleAvatarPresets = avatarPresetsFor(avatarInput.gender)
  const resolvedBodyProfile = useMemo(
    () =>
      selectedAvatarPreset
        ? resolveBodyPreview(selectedAvatarPreset.profile, avatarInput)
        : null,
    [avatarInput, selectedAvatarPreset],
  )
  const allFitTags = useMemo(
    () =>
      garments.map((item) =>
        resolvedBodyProfile
          ? deriveFitPreview(
              item.slot,
              item.measurements,
              resolvedBodyProfile,
            )
          : [],
      ),
    [garments, resolvedBodyProfile],
  )
  const selectedDatasetCase = useMemo(
    () =>
      [...(testDataset?.cases ?? []), ...(testDataset?.outfit_cases ?? [])].find(
        (testCase) => testCase.id === selectedDatasetCaseId,
      ),
    [selectedDatasetCaseId, testDataset],
  )

  const replaceAvatar = (file: File, preview: string) => {
    if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview)
    setAvatar(file)
    setAvatarPreview(preview)
  }

  const selectAvatarPreset = async (preset: AvatarPreset) => {
    setAvatarBusyId(preset.id)
    setSelectedDatasetCaseId('')
    setError('')
    try {
      replaceAvatar(await avatarPresetFile(preset), preset.imageUrl)
      setSelectedAvatarPresetId(preset.id)
      setAvatarInput((current) => ({
        ...current,
        preset_id: preset.id,
        gender: preset.profile.gender,
      }))
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setAvatarBusyId('')
    }
  }

  const loadDatasetCase = async (testCase: Round2PresetCase) => {
    const avatarPreset = findAvatarPreset(testCase.avatar.preset_id)
    if (!avatarPreset) {
      setError(`등록되지 않은 아바타 프리셋입니다. (${testCase.avatar.preset_id})`)
      return
    }

    setAvatarBusyId(`dataset:${testCase.id}`)
    setError('')
    try {
      const caseGarments = garmentsForCase(testCase)
      const [avatarFile, ...garmentFiles] = await Promise.all([
        avatarPresetFile(avatarPreset),
        ...caseGarments.map((garment) =>
          imageFileFromDemoData(
            garment.image_url,
            datasetFileName(garment),
          ),
        ),
      ])
      replaceAvatar(avatarFile, avatarPreset.imageUrl)
      garments.forEach((item) => {
        if (item.preview.startsWith('blob:')) URL.revokeObjectURL(item.preview)
      })
      setSelectedAvatarPresetId(avatarPreset.id)
      setAvatarInput({ ...testCase.avatar })
      setScenarioName(testCase.name)
      setGarments(
        caseGarments.map((garment, index) => ({
          id: crypto.randomUUID(),
          file: garmentFiles[index],
          preview: URL.createObjectURL(garmentFiles[index]),
          slot: garment.slot,
          caption: garment.caption,
          referenceType: garment.reference_type,
          selectedSize: garment.selected_size,
          measurements: { ...garment.measurements },
        })),
      )
      setSelectedDatasetCaseId(testCase.id)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setAvatarBusyId('')
    }
  }

  const changeGender = (gender: Round2BodyGender) => {
    if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview)
    setAvatar(null)
    setAvatarPreview('')
    setSelectedAvatarPresetId('')
    setSelectedDatasetCaseId('')
    setAvatarInput((current) => ({ ...current, preset_id: '', gender }))
    setError('')
  }

  const updateGarment = (
    id: string,
    patch:
      | Partial<Round2GarmentDraft>
      | ((current: Round2GarmentDraft) => Partial<Round2GarmentDraft>),
  ) => {
    setSelectedDatasetCaseId('')
    setGarments((items) =>
      items.map((item) => {
        if (item.id !== id) return item
        const nextPatch = typeof patch === 'function' ? patch(item) : patch
        return { ...item, ...nextPatch }
      }),
    )
  }

  const uploadGarment = (id: string, file: File) => {
    const validationError = validateImage(file)
    if (validationError) {
      setError(validationError)
      return
    }
    updateGarment(id, (current) => {
      if (current.preview.startsWith('blob:')) {
        URL.revokeObjectURL(current.preview)
      }
      return { file, preview: URL.createObjectURL(file) }
    })
    setError('')
  }

  const removeGarment = (id: string) => {
    const removed = garments.find((item) => item.id === id)
    if (removed?.preview.startsWith('blob:')) {
      URL.revokeObjectURL(removed.preview)
    }
    setGarments((items) => items.filter((item) => item.id !== id))
  }

  const addGarment = () => {
    const usedSlots = new Set(garments.map((item) => item.slot))
    const nextSlot =
      (['BOTTOM', 'OUTER', 'TOP', 'DRESS'] as Slot[]).find(
        (slot) => !usedSlots.has(slot),
      ) || 'BOTTOM'
    setGarments((items) => [...items, newGarment(nextSlot)])
  }

  const validate = () => {
    if (!scenarioName.trim()) return '테스트 케이스 이름을 입력해 주세요.'
    if (scenarioName.trim().length > 120) {
      return '테스트 케이스 이름은 120자 이하여야 합니다.'
    }
    if (!avatar || !selectedAvatarPresetId) {
      return '성별에 맞는 사전제작 아바타를 선택해 주세요.'
    }
    for (const field of bodyInputFields) {
      const value = avatarInput[field.key]
      if (!Number.isFinite(value) || value < field.min || value > field.max) {
        return `${field.label} 값을 ${field.min}–${field.max}${field.unit} 범위로 입력해 주세요.`
      }
    }
    if (garments.length < 1 || garments.length > 3) {
      return '의류는 1개에서 3개까지 입력할 수 있습니다.'
    }
    const slots = garments.map((item) => item.slot)
    if (new Set(slots).size !== slots.length) {
      return '의류 슬롯은 중복될 수 없습니다.'
    }
    if (slots.includes('DRESS') && (slots.includes('TOP') || slots.includes('BOTTOM'))) {
      return '원피스는 상의 또는 하의와 함께 넣을 수 없습니다.'
    }
    for (const [index, garment] of garments.entries()) {
      const garmentNumber = index + 1
      if (!garment.file) return `의류 ${garmentNumber} 이미지를 선택해 주세요.`
      if (!garment.caption.trim()) {
        return `의류 ${garmentNumber} 상품 설명을 입력해 주세요.`
      }
      if (garment.caption.trim().length > 500) {
        return `의류 ${garmentNumber} 상품 설명은 500자 이하여야 합니다.`
      }
      if (!garment.selectedSize.trim()) {
        return `의류 ${garmentNumber}에서 선택한 사이즈를 입력해 주세요.`
      }
      const requiredKeys = requiredMeasurementsBySlot[garment.slot]
      for (const key of requiredKeys) {
        const value = garment.measurements[key]
        if (!value || !Number.isFinite(value) || value <= 0 || value > 250) {
          const field = measurementFieldsBySlot[garment.slot].find(
            (item) => item.key === key,
          )
          return `의류 ${garmentNumber}의 ${field?.label || key} 실측을 입력해 주세요.`
        }
      }
    }
    return ''
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setBusy(true)
    setError('')
    try {
      const result = await createRunRound2({
        scenarioName: scenarioName.trim(),
        avatar: avatar as File,
        avatarInput,
        garments,
        mockMode,
      })
      navigate({ name: 'run', runId: result.run_id })
    } catch (reason) {
      setError((reason as Error).message)
      setBusy(false)
    }
  }

  return (
    <main className="round2-shell">
      <header className="round2-topbar">
        <a className="round2-brand" href={routeHref({ name: 'round1-setup' })}>
          <span>G</span>
          <b>GORDI</b>
          <small>MODEL LAB / ROUND 02</small>
        </a>
        <nav aria-label="평가 단계 이동">
          <a href={routeHref({ name: 'round1-setup' })}>1차 페이지</a>
          <a href={routeHref({ name: 'round1-dashboard' })}>1차 결과</a>
          <a href={routeHref({ name: 'round2-dashboard' })}>2차 결과</a>
          <span><i /> {evaluatorId}</span>
        </nav>
      </header>

      <section className="round2-hero">
        <div>
          <p className="round2-kicker">BLIND IMAGE EVALUATION · ROUND 02</p>
          <h1>
            치수를 읽고,
            <br />
            인물을 분리한다.
          </h1>
        </div>
        <div className="round2-hero-note">
          <span>이번 검증의 변화</span>
          <p>
            고정 핏 태그 대신 선택한 사이즈의 실측과 아바타 명목 치수를
            비교합니다. 착용 레퍼런스 속 모델은 의류 정보만 참고하도록
            명시적으로 구분합니다.
          </p>
          <dl>
            <div><dt>후보</dt><dd>4 models</dd></div>
            <div><dt>비교</dt><dd>6 pairs</dd></div>
            <div><dt>프롬프트</dt><dd>v2</dd></div>
          </dl>
        </div>
      </section>

      <section className="round2-model-section" aria-labelledby="round2-model-title">
        <div className="round2-section-title">
          <span>01</span>
          <div>
            <p className="round2-kicker">FIXED CANDIDATES</p>
            <h2 id="round2-model-title">1차 상위 4개 모델만 비교</h2>
          </div>
          <small>서버의 ROUND_2 프로필로 고정됩니다.</small>
        </div>
        <div className="round2-model-grid">
          {round2Models.map((model, index) => (
            <article key={model.providerId}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <small>{model.role}</small>
              <h3>{model.displayName}</h3>
              <code>{model.providerId}</code>
            </article>
          ))}
        </div>
      </section>

      <form className="round2-form" onSubmit={handleSubmit}>
        <section className="round2-panel">
          <div className="round2-section-title">
            <span>02</span>
            <div>
              <p className="round2-kicker">TEST CASE</p>
              <h2>실행 설정</h2>
            </div>
            <label className="round2-switch">
              <input
                type="checkbox"
                checked={mockMode}
                onChange={(event) => setMockMode(event.target.checked)}
              />
              <span>목업 모드</span>
            </label>
          </div>
          <div className="round2-case-row">
            <label>
              <span>케이스 이름</span>
              <input
                maxLength={120}
                value={scenarioName}
                onChange={(event) => {
                  setScenarioName(event.target.value)
                  setSelectedDatasetCaseId('')
                }}
              />
            </label>
            <p>
              {mockMode
                ? '외부 API 비용 없이 4개 후보·6개 비교 흐름을 확인합니다.'
                : '상위 4개 모델을 실제 호출합니다. 생성 비용이 발생할 수 있습니다.'}
            </p>
          </div>
          <div className="round2-dataset-heading">
            <div>
              <p>CURATED DATASET · MUSINSA</p>
              <h3>단일 의상 프리셋 6개</h3>
            </div>
            <small>
              {testDataset
                ? `${testDataset.collected_at} 수집 · 내부 평가 전용`
                : '데이터셋 불러오는 중…'}
            </small>
          </div>
          <div className="round2-dataset-grid" aria-label="2차 테스트 데이터셋">
            {testDataset?.cases.map((testCase) => (
              <button
                type="button"
                className={
                  selectedDatasetCaseId === testCase.id
                    ? 'round2-dataset-card is-selected'
                    : 'round2-dataset-card'
                }
                aria-pressed={selectedDatasetCaseId === testCase.id}
                disabled={Boolean(avatarBusyId)}
                key={testCase.id}
                onClick={() => void loadDatasetCase(testCase)}
              >
                <img
                  src={mediaUrl(testCase.garment.image_url)}
                  alt={testCase.garment.caption}
                />
                <span>
                  <small>
                    {testCase.axis === 'SIZE_SENSITIVITY'
                      ? 'SIZE SENSITIVITY'
                      : 'REFERENCE CONTAMINATION'}
                  </small>
                  <b>{testCase.name}</b>
                  <em>
                    {testCase.garment.reference_type === 'product-only'
                      ? '상품 단독컷'
                      : '인물 포함'}
                    {' · '}
                    SIZE {testCase.garment.selected_size}
                  </em>
                </span>
              </button>
            ))}
          </div>
          <div className="round2-dataset-heading round2-outfit-heading">
            <div>
              <p>TOP + BOTTOM OUTFITS</p>
              <h3>상·하의 조합 프리셋 6개</h3>
            </div>
            <small>여성 3개 · 남성 3개</small>
          </div>
          <div
            className="round2-dataset-grid"
            aria-label="2차 상하의 조합 테스트 데이터셋"
          >
            {testDataset?.outfit_cases.map((testCase) => (
              <button
                type="button"
                className={
                  selectedDatasetCaseId === testCase.id
                    ? 'round2-dataset-card is-selected'
                    : 'round2-dataset-card'
                }
                aria-pressed={selectedDatasetCaseId === testCase.id}
                disabled={Boolean(avatarBusyId)}
                key={testCase.id}
                onClick={() => void loadDatasetCase(testCase)}
              >
                <div className="round2-dataset-images" aria-hidden="true">
                  {testCase.garments.map((garment) => (
                    <img
                      src={mediaUrl(garment.image_url)}
                      alt=""
                      key={`${testCase.id}-${garment.slot}`}
                    />
                  ))}
                </div>
                <span>
                  <small>OUTFIT COMBINATION</small>
                  <b>{testCase.name}</b>
                  <em>
                    {testCase.garments
                      .map(
                        (garment) =>
                          `${slotLabels[garment.slot]} ${garment.selected_size}`,
                      )
                      .join(' · ')}
                  </em>
                </span>
              </button>
            ))}
          </div>
          {selectedDatasetCaseId && (
            <p className="round2-dataset-hypothesis">
              <b>검증 가설</b>
              {selectedDatasetCase?.hypothesis}
            </p>
          )}
        </section>

        <section className="round2-panel">
          <div className="round2-section-title">
            <span>03</span>
            <div>
              <p className="round2-kicker">PERSON AUTHORITY</p>
              <h2>성별·키·몸무게와 아바타</h2>
            </div>
            <small>MVP 사용자 입력은 세 항목과 프리셋 선택으로 제한됩니다.</small>
          </div>

          <div className="round2-mvp-inputs">
            <label>
              <span>성별</span>
              <select
                value={avatarInput.gender}
                onChange={(event) =>
                  changeGender(event.target.value as Round2BodyGender)
                }
              >
                <option value="FEMALE">여성</option>
                <option value="MALE">남성</option>
              </select>
            </label>
            {bodyInputFields.map((field) => (
              <label key={field.key}>
                <span>{field.label}<small>{field.unit}</small></span>
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  step="0.1"
                  value={avatarInput[field.key] || ''}
                  onChange={(event) => {
                    setAvatarInput((current) => ({
                      ...current,
                      [field.key]: Number(event.target.value),
                    }))
                    setSelectedDatasetCaseId('')
                  }}
                />
              </label>
            ))}
            <p>
              어깨·가슴·허리·팔·인심 값은 선택한 아바타의 내부 기준값을
              키와 몸무게에 맞춰 서버가 보정합니다.
            </p>
          </div>

          <div className="round2-avatar-grid" aria-label="선탑재 아바타">
            {visibleAvatarPresets.map((preset) => (
              <button
                type="button"
                className={
                  selectedAvatarPresetId === preset.id
                    ? 'round2-avatar-card is-selected'
                    : 'round2-avatar-card'
                }
                aria-pressed={selectedAvatarPresetId === preset.id}
                disabled={Boolean(avatarBusyId)}
                key={preset.id}
                onClick={() => void selectAvatarPreset(preset)}
              >
                <img
                  src={preset.imageUrl}
                  alt={`${preset.genderLabel} ${preset.bodyTypeLabel} 마네킹`}
                />
                <span>
                  <b>{preset.genderLabel}</b>
                  <small>
                    {avatarBusyId === preset.id
                      ? '불러오는 중…'
                      : preset.bodyTypeLabel}
                  </small>
                </span>
              </button>
            ))}
          </div>

          <div className="round2-profile-layout">
            <div className="round2-avatar-upload">
              <p>선택된 PERSON BASE</p>
              <div className="round2-avatar-selection">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="선택된 아바타 미리보기" />
                ) : (
                  <span><b>+</b>위에서 아바타를 선택하세요</span>
                )}
              </div>
              <small>직접 업로드 없이 등록된 성별별 아바타만 사용합니다.</small>
            </div>

            <div className="round2-profile-editor">
              <div className="round2-profile-heading">
                <div>
                  <p>SERVER-RESOLVED PROFILE</p>
                  <h3>프리셋 기반 내부 핏 계산</h3>
                </div>
                <span>{selectedAvatarPresetId || '아바타 미선택'}</span>
              </div>
              <p className="round2-profile-notice">
                {selectedAvatarPreset
                  ? `${selectedAvatarPreset.profile.label} 기준값을 사용합니다. 사용자가 입력한 키와 몸무게로 내부 신체 기준을 보정한 뒤, 선택한 의류 사이즈의 실측과 비교해 핏 태그를 계산합니다.`
                  : '성별을 선택한 뒤 아바타를 고르면 서버용 내부 신체 기준이 연결됩니다.'}
              </p>
              <dl className="round2-profile-summary">
                <div><dt>사용자 입력</dt><dd>성별 · 키 · 몸무게</dd></div>
                <div><dt>체형 기준</dt><dd>{selectedAvatarPreset?.bodyTypeLabel || '미선택'}</dd></div>
                <div><dt>상세 치수</dt><dd>서버 내부 계산</dd></div>
              </dl>
            </div>
          </div>
        </section>

        <section className="round2-panel">
          <div className="round2-section-title">
            <span>04</span>
            <div>
              <p className="round2-kicker">GARMENT SIZE INPUT</p>
              <h2>의류·선택 사이즈·실측</h2>
            </div>
            <button
              className="round2-add-button"
              type="button"
              disabled={garments.length >= 3}
              onClick={addGarment}
            >
              + 의류 추가
            </button>
          </div>

          <div className="round2-reference-rule">
            <b>착용컷 처리 원칙</b>
            <p>
              상품 단독컷이 아니면 반드시 ‘인물 착용컷’으로 표시합니다.
              레퍼런스 속 얼굴·체형·포즈는 무시하고 의류 외형만 추출하도록 서버
              프롬프트에 전달됩니다.
            </p>
            <span className={personWornCount ? 'has-worn-reference' : ''}>
              착용컷 {personWornCount}개
            </span>
          </div>

          <div className="round2-garment-list">
            {garments.map((garment, index) => {
              const fitTags = allFitTags[index]
              const requiredKeys = new Set(
                requiredMeasurementsBySlot[garment.slot],
              )
              return (
                <article className="round2-garment-card" key={garment.id}>
                  <div className="round2-garment-index">
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <b>{slotLabels[garment.slot]}</b>
                    {garments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeGarment(garment.id)}
                        aria-label={`의류 ${index + 1} 삭제`}
                      >
                        삭제
                      </button>
                    )}
                  </div>

                  <div className="round2-garment-main">
                    <label className="round2-garment-upload">
                      {garment.preview ? (
                        <img
                          src={garment.preview}
                          alt={`의류 ${index + 1} 미리보기`}
                        />
                      ) : (
                        <span><b>+</b>의류 이미지</span>
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) uploadGarment(garment.id, file)
                        }}
                      />
                    </label>

                    <div className="round2-garment-fields">
                      <div className="round2-garment-basics">
                        <label>
                          <span>슬롯</span>
                          <select
                            value={garment.slot}
                            onChange={(event) =>
                              updateGarment(garment.id, {
                                slot: event.target.value as Slot,
                                measurements: {},
                              })
                            }
                          >
                            {Object.entries(slotLabels).map(([value, label]) => (
                              <option value={value} key={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="round2-caption-field">
                          <span>상품 설명</span>
                          <input
                            maxLength={500}
                            placeholder="예: 네이비 코튼 버튼다운 셔츠"
                            value={garment.caption}
                            onChange={(event) =>
                              updateGarment(garment.id, {
                                caption: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          <span>선택 사이즈</span>
                          <input
                            list={`round2-size-${garment.id}`}
                            maxLength={40}
                            placeholder="M / 95 / 28"
                            value={garment.selectedSize}
                            onChange={(event) => {
                              const selectedSize = event.target.value
                              updateGarment(garment.id, (current) => ({
                                selectedSize,
                                measurements:
                                  current.selectedSize === selectedSize
                                    ? current.measurements
                                    : {},
                              }))
                            }}
                          />
                          <datalist id={`round2-size-${garment.id}`}>
                            {['XS', 'S', 'M', 'L', 'XL', 'FREE'].map((size) => (
                              <option value={size} key={size} />
                            ))}
                          </datalist>
                        </label>
                      </div>

                      <fieldset className="round2-reference-type">
                        <legend>레퍼런스 이미지 유형</legend>
                        <button
                          type="button"
                          className={
                            garment.referenceType === 'product-only'
                              ? 'is-selected'
                              : ''
                          }
                          onClick={() =>
                            updateGarment(garment.id, {
                              referenceType: 'product-only',
                            })
                          }
                        >
                          <b>상품 단독컷</b>
                          <small>사람이 보이지 않음</small>
                        </button>
                        <button
                          type="button"
                          className={
                            garment.referenceType === 'worn-reference'
                              ? 'is-selected is-warning'
                              : ''
                          }
                          onClick={() =>
                            updateGarment(garment.id, {
                              referenceType: 'worn-reference',
                            })
                          }
                        >
                          <b>인물 착용컷</b>
                          <small>인물 정보 무시 지시</small>
                        </button>
                      </fieldset>

                      <div className="round2-measure-block">
                        <div>
                          <h4>{slotLabels[garment.slot]} 실측</h4>
                          <p>판매 페이지의 선택 사이즈 기준 단면·길이(cm)</p>
                        </div>
                        <div className="round2-measure-grid">
                          {measurementFieldsBySlot[garment.slot].map((field) => (
                            <label key={field.key}>
                              <span>
                                {field.label}
                                {requiredKeys.has(field.key) && <b>필수</b>}
                                <small>{field.hint}</small>
                              </span>
                              <input
                                type="number"
                                min="1"
                                max="250"
                                step="0.1"
                                value={garment.measurements[field.key] ?? ''}
                                onChange={(event) => {
                                  const rawValue = event.target.value
                                  updateGarment(garment.id, (current) => {
                                    const measurements = {
                                      ...current.measurements,
                                    }
                                    if (!rawValue) {
                                      delete measurements[field.key]
                                    } else {
                                      measurements[field.key] = Number(rawValue)
                                    }
                                    return { measurements }
                                  })
                                }}
                              />
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="round2-fit-preview" aria-live="polite">
                        <div>
                          <span>CLIENT PREVIEW · relative-fit-v1</span>
                          <b>예상 핏 태그</b>
                        </div>
                        <div>
                          {fitTags.length ? (
                            fitTags.map((tag) => <span key={tag}>{tag}</span>)
                          ) : (
                            <small>실측을 입력하면 예상 태그가 표시됩니다.</small>
                          )}
                        </div>
                        <p>
                          미리보기는 입력 확인용입니다. 최종 태그와 프롬프트 문장은
                          서버가 원시 치수로 다시 계산합니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        {error && (
          <div className="round2-error" role="alert">
            <b>입력을 확인해 주세요.</b>
            <span>{error}</span>
          </div>
        )}

        <section className="round2-submit">
          <div>
            <p className="round2-kicker">READY FOR ROUND 02</p>
            <h2>원시 치수를 서버에 넘기고 블라인드 비교를 시작합니다.</h2>
            <small>
              {garments.length} garments · {personWornCount} worn references ·
              {' '}{mockMode ? 'mock mode' : 'commercial calls'}
            </small>
          </div>
          <button type="submit" disabled={busy}>
            {busy ? '2차 Run 생성 중…' : '2차 블라인드 테스트 시작'}
            <span>→</span>
          </button>
        </section>
      </form>
    </main>
  )
}

export default Round2SetupPage
