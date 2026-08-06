import { useEffect, useState } from 'react'

import {
  createRun,
  getDemoTestDataset,
  getSetup,
  imageFileFromDemoData,
} from '../api'
import DashboardEntry from '../components/DashboardEntry'
import ImagePicker from '../components/ImagePicker'
import { navigate } from '../routing'
import type { AvatarPreset } from '../shared/avatarPresets'
import { avatarPresetFile, avatarPresets } from '../shared/avatarPresets'
import { slotLabels } from '../shared/constants'
import type {
  DemoTestDataset,
  GarmentDraft,
  SetupInfo,
  Slot,
} from '../types'

const newGarment = (slot: Slot = 'TOP'): GarmentDraft => ({
  id: crypto.randomUUID(),
  file: null,
  preview: '',
  slot,
  caption: '',
  fitNote: '',
})

export default function Round1SetupPage({
  evaluatorId,
}: {
  evaluatorId: string
}) {
  const [scenarioName, setScenarioName] = useState('스탠다드 체형 · 미니멀 데일리룩')
  const [mockMode, setMockMode] = useState(true)
  const [avatar, setAvatar] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [selectedAvatarPresetId, setSelectedAvatarPresetId] = useState('')
  const [avatarPresetBusyId, setAvatarPresetBusyId] = useState('')
  const [garments, setGarments] = useState<GarmentDraft[]>([newGarment()])
  const [testDataset, setTestDataset] = useState<DemoTestDataset | null>(null)
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [presetBusy, setPresetBusy] = useState(false)
  const [setup, setSetup] = useState<SetupInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getSetup(1).then(setSetup).catch(() => setSetup(null))
    getDemoTestDataset().then((dataset) => {
      setTestDataset(dataset)
      setSelectedPresetId(dataset.cases[0]?.id || '')
    }).catch(() => setTestDataset(null))
  }, [])

  useEffect(() => () => {
    if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview)
  }, [avatarPreview])

  const selectedPreset = avatarPresets.find(
    (item) => item.id === selectedAvatarPresetId,
  )

  const updateGarment = (id: string, patch: Partial<GarmentDraft>) => {
    setGarments((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const selectAvatarPreset = async (preset: AvatarPreset) => {
    setAvatarPresetBusyId(preset.id)
    setError('')
    try {
      setAvatar(await avatarPresetFile(preset))
      setAvatarPreview(preset.imageUrl)
      setSelectedAvatarPresetId(preset.id)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setAvatarPresetBusyId('')
    }
  }

  const loadTestPreset = async () => {
    const preset = testDataset?.cases.find((item) => item.id === selectedPresetId)
    if (!preset) return
    setPresetBusy(true)
    setError('')
    try {
      const nextGarments = await Promise.all(
        preset.garments.map(async (item) => {
          const file = await imageFileFromDemoData(item.image_url, item.file_name)
          return {
            id: crypto.randomUUID(),
            file,
            preview: URL.createObjectURL(file),
            slot: item.slot,
            caption: item.caption,
            fitNote: item.fit_tags.join(', '),
            sourceUrl: item.source_url,
            referenceType: item.reference_type,
          } satisfies GarmentDraft
        }),
      )
      setScenarioName(preset.name)
      setGarments(nextGarments)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setPresetBusy(false)
    }
  }

  const handleCreate = async () => {
    setError('')
    if (!avatar) return setError('아바타 이미지를 선택해 주세요.')
    if (garments.some((item) => !item.file || !item.caption.trim())) {
      return setError('모든 의류에 이미지와 캡션을 입력해 주세요.')
    }
    const slots = garments.map((item) => item.slot)
    if (new Set(slots).size !== slots.length) return setError('의류 슬롯은 중복될 수 없습니다.')
    if (slots.includes('DRESS') && (slots.includes('TOP') || slots.includes('BOTTOM'))) {
      return setError('원피스는 상의 또는 하의와 함께 넣을 수 없습니다.')
    }
    setBusy(true)
    try {
      const created = await createRun({ scenarioName, avatar, garments, mockMode })
      navigate({ name: 'run', runId: created.run_id }, { replace: true })
    } catch (reason) {
      setError((reason as Error).message)
      setBusy(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span>G</span><b>GORDI</b> / MODEL LAB</div>
        <div className="identity"><i /> {evaluatorId}</div>
      </header>

      <section className="intro-grid">
        <div>
          <p className="kicker">BLIND IMAGE EVALUATION · 01</p>
          <h1>입력은 하나로,<br />판단은 편견 없이.</h1>
        </div>
        <div className="intro-note">
          <p>동일한 아바타·의류·프롬프트를 후보 모델에 전달하고, 결과를 전수 A/B 비교합니다.</p>
          <div className="setup-strip">
            <span><b>{setup?.commercial_candidate_count ?? 7}</b> 상용 후보</span>
            <span><b>{setup?.configured_commercial_count ?? '—'}</b> API 연결</span>
            <span><b>{setup?.fallback_configured ? 'ON' : 'OFF'}</b> FLUX 폴백</span>
          </div>
        </div>
      </section>

      <section className="workspace-card">
        <div className="section-heading">
          <div><span>01</span><h2>테스트 케이스</h2></div>
          <label className="mode-toggle">
            <input type="checkbox" checked={mockMode} onChange={(e) => setMockMode(e.target.checked)} />
            <span>목업 모드</span>
          </label>
        </div>
        <p className="mode-help">
          {mockMode
            ? 'API 비용 없이 업로드·블라인드 배정·평가 저장 흐름만 검증합니다.'
            : '설정된 상용 모델을 OpenRouter로 호출합니다. 모든 상용 호출이 실패할 때만 FLUX 폴백을 시도합니다.'}
        </p>
        {testDataset && (
          <div className="preset-panel">
            <div>
              <span>DEMO TEST DATA / MUSINSA</span>
              <b>수집된 상·하의 세트 불러오기</b>
              <small>{testDataset.usage_notice}</small>
            </div>
            <label>
              <span>테스트 세트</span>
              <select value={selectedPresetId} onChange={(event) => setSelectedPresetId(event.target.value)}>
                {testDataset.cases.map((item) => (
                  <option value={item.id} key={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <button type="button" disabled={presetBusy} onClick={loadTestPreset}>
              {presetBusy ? '불러오는 중…' : '샘플 불러오기'}
            </button>
          </div>
        )}
        <label className="field wide">
          <span>케이스 이름</span>
          <input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} />
        </label>

        <section className="avatar-preset-panel" aria-labelledby="avatar-preset-title">
          <div className="avatar-preset-heading">
            <div>
              <span>PRELOADED AVATARS / {avatarPresets.length}</span>
              <b id="avatar-preset-title">마네킹 체형 선택</b>
            </div>
            <small>
              {selectedPreset
                ? `${selectedPreset.genderLabel} · ${selectedPreset.bodyTypeLabel} 선택됨`
                : '성별과 체형을 선택해 주세요.'}
            </small>
          </div>
          <div className="avatar-preset-grid">
            {avatarPresets.map((preset) => (
              <button
                type="button"
                className={`avatar-preset-card ${selectedAvatarPresetId === preset.id ? 'active' : ''}`}
                aria-pressed={selectedAvatarPresetId === preset.id}
                disabled={Boolean(avatarPresetBusyId)}
                key={preset.id}
                onClick={() => void selectAvatarPreset(preset)}
              >
                <img src={preset.imageUrl} alt={`${preset.genderLabel} ${preset.bodyTypeLabel} 마네킹`} />
                <span>
                  <b>{preset.genderLabel}</b>
                  <small>{avatarPresetBusyId === preset.id ? '준비 중…' : preset.bodyTypeLabel}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="asset-grid">
          <div className="avatar-column">
            <p className="column-label">AVATAR / PERSON BASE</p>
            <ImagePicker
              label="아바타 직접 업로드"
              preview={avatarPreview}
              onChange={(file) => {
                setAvatar(file)
                setAvatarPreview(URL.createObjectURL(file))
                setSelectedAvatarPresetId('')
              }}
            />
            <small className="asset-tip">선탑재 아바타 선택 또는 직접 업로드</small>
          </div>
          <div className="garment-column">
            <div className="column-head">
              <p className="column-label">GARMENTS / 1—3</p>
              <button
                type="button"
                className="text-button"
                disabled={garments.length >= 3}
                onClick={() => setGarments((items) => [...items, newGarment('BOTTOM')])}
              >
                + 의류 추가
              </button>
            </div>
            {garments.map((garment, index) => (
              <div className="garment-row" key={garment.id}>
                <ImagePicker
                  compact
                  label={`의류 ${index + 1}`}
                  preview={garment.preview}
                  onChange={(file) => updateGarment(garment.id, { file, preview: URL.createObjectURL(file) })}
                />
                <div className="garment-fields">
                  <div className="inline-fields">
                    <label className="field">
                      <span>슬롯</span>
                      <select value={garment.slot} onChange={(e) => updateGarment(garment.id, { slot: e.target.value as Slot })}>
                        {Object.entries(slotLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                      </select>
                    </label>
                    <label className="field grow">
                      <span>상품 캡션</span>
                      <input
                        placeholder="예: 네이비 오버핏 코튼 셔츠"
                        value={garment.caption}
                        onChange={(e) => updateGarment(garment.id, { caption: e.target.value })}
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span>핏 태그 / 수치 해석</span>
                    <input
                      placeholder="예: 여유로운 핏, 엉덩이를 덮는 길이"
                      value={garment.fitNote}
                      onChange={(e) => updateGarment(garment.id, { fitNote: e.target.value })}
                    />
                  </label>
                  {garment.sourceUrl && (
                    <div className="source-note">
                      <a href={garment.sourceUrl} target="_blank" rel="noreferrer">무신사 원본 상품</a>
                      <span>{garment.referenceType === 'product-only' ? '단독 상품 컷' : '착용 레퍼런스 컷'}</span>
                    </div>
                  )}
                </div>
                {garments.length > 1 && (
                  <button className="remove-button" type="button" aria-label="의류 삭제" onClick={() => setGarments((items) => items.filter((item) => item.id !== garment.id))}>×</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}
        <div className="action-row">
          <p>PNG · JPEG · WebP / 파일당 최대 10MB</p>
          <button className="primary-button" type="button" disabled={busy} onClick={handleCreate}>
            {busy ? '준비 중…' : '블라인드 테스트 시작'} <span>→</span>
          </button>
        </div>
      </section>

      <DashboardEntry to={{ name: 'round1-dashboard' }} />
    </main>
  )
}
