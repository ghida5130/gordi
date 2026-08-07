import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

import arrowImage from '@/assets/images/arrow.svg'
import TierMakerIcon from '@/components/tierMaker/TierMakerIcon'

const participantColors = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
]

function ParticipantDock({
  participants,
  currentParticipantId,
  maxParticipants,
  isConnected,
  isMicMuted,
  isSpeakerMuted,
  isMicControlPending,
  voiceConnectionState,
  voiceError,
  needsAudioStart,
  onToggleMic,
  onToggleSpeaker,
  onStartAudio,
  onRetryVoice,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const voiceControlsDisabled = voiceConnectionState !== 'CONNECTED'
  const voiceNotice = voiceError ||
    (voiceConnectionState === 'ERROR' ? '음성 연결을 확인해 주세요.' : '')

  return (
    <AnimatePresence mode="wait" initial={false}>
      {isCollapsed ? (
        <motion.button
          key="participant-dock-collapsed"
          type="button"
          initial={{ opacity: 0, y: 70, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 70, scale: 0.96 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => setIsCollapsed(false)}
          className="fixed inset-x-0 bottom-4 z-[60] mx-auto flex h-12 w-fit min-w-28 items-end justify-center rounded-full border border-slate-200 bg-white/95 px-3.5 pb-1.5 pt-4 shadow-[0_18px_45px_rgba(15,23,42,0.2)] backdrop-blur-md"
          aria-label={`${isMicMuted ? '마이크 음소거 중' : '마이크 사용 중'}, ${isSpeakerMuted ? '스피커 음소거 중' : '스피커 사용 중'}, 참여자 현황 펼치기`}
        >
          <img
            src={arrowImage}
            alt=""
            aria-hidden="true"
            className="absolute left-1/2 top-1 size-2 -translate-x-1/2 rotate-180 object-contain opacity-45"
          />
          <span className="flex items-center gap-2">
            <span className={`flex size-6 items-center justify-center rounded-full ${isMicMuted ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
              <TierMakerIcon name={isMicMuted ? 'micOff' : 'mic'} size={13} />
            </span>
            <span className={`flex size-6 items-center justify-center rounded-full ${isSpeakerMuted ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-600'}`}>
              <TierMakerIcon name={isSpeakerMuted ? 'speakerOff' : 'speaker'} size={13} />
            </span>
          </span>
        </motion.button>
      ) : (
        <motion.section
          key="participant-dock-expanded"
          layout
          initial={{ opacity: 0, y: 120 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 120 }}
          transition={{
            duration: 0.34,
            ease: [0.22, 1, 0.36, 1],
            layout: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
          }}
          className="fixed inset-x-0 bottom-3 z-[60] mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center justify-between gap-3 rounded-full border border-slate-200 bg-white/95 px-4 pb-2 pt-4 shadow-[0_22px_65px_rgba(15,23,42,0.16)] backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            className="absolute left-1/2 top-0.5 flex h-4 w-24 -translate-x-1/2 items-center justify-center"
            aria-label="참여자 현황 숨기기"
          >
            <img src={arrowImage} alt="" aria-hidden="true" className="size-2.5 object-contain opacity-45 transition-transform duration-200 hover:translate-y-0.5" />
          </button>
      <div className="flex min-w-0 items-center gap-3 overflow-x-auto py-1">
        <div className="mr-1 shrink-0 border-r border-slate-200 pr-4">
          <p className="text-xs font-bold text-slate-800">참여자</p>
          <p className="mt-1 text-[11px] text-slate-400">
            {participants.length} / {maxParticipants}명
          </p>
        </div>
        {participants.map((participant, index) => {
          const isCurrent =
            participant.participantId === currentParticipantId

          return (
            <div
              key={participant.participantId}
              className={`flex min-w-[142px] items-center gap-2 rounded-2xl border px-2.5 py-1 ${
                isCurrent
                  ? 'border-emerald-300 bg-emerald-50/50'
                  : 'border-slate-100 bg-slate-50'
              }`}
            >
              <div
                className={`relative flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  participantColors[index % participantColors.length]
                }`}
              >
                {(participant.nickname ?? '?').slice(0, 2)}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white ${
                    isConnected ? 'bg-emerald-400' : 'bg-slate-300'
                  }`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-800">
                  {participant.nickname ?? '이름 없음'}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-slate-400">
                  {participant.role === 'HOST' ? '방장' : '참여자'}
                  {isCurrent ? ' · 나' : ''}
                </p>
              </div>
              {isCurrent && (
                <span
                  className={
                    isMicMuted ? 'text-slate-300' : 'text-emerald-500'
                  }
                >
                  <TierMakerIcon
                    name={isMicMuted ? 'micOff' : 'mic'}
                    size={14}
                  />
                </span>
              )}
            </div>
          )
        })}
      </div>

      <div className="relative flex shrink-0 items-center gap-2 border-l border-slate-100 pl-4">
        {voiceNotice && (
          <div className="absolute bottom-[calc(100%+0.75rem)] right-0 flex max-w-[420px] items-center gap-3 rounded-2xl border border-red-100 bg-white px-4 py-2.5 text-[11px] leading-4 text-red-600 shadow-[0_14px_35px_rgba(15,23,42,0.14)]" role="alert">
            <p className="min-w-0 break-keep text-balance">{voiceNotice}</p>
            {voiceConnectionState === 'ERROR' && (
              <button
                type="button"
                onClick={onRetryVoice}
                className="shrink-0 font-bold text-violet-600 hover:text-violet-800"
              >
                다시 연결
              </button>
            )}
          </div>
        )}
          {needsAudioStart && (
            <button
              type="button"
              onClick={onStartAudio}
              className="flex h-9 items-center gap-2 rounded-full bg-violet-100 px-3.5 text-xs font-bold text-violet-700 hover:bg-violet-200"
            >
              <TierMakerIcon name="speaker" size={17} />
              음성 듣기
            </button>
          )}
          <button
            type="button"
            onClick={onToggleMic}
            disabled={voiceControlsDisabled || isMicControlPending}
            aria-pressed={isMicMuted}
            className={`flex size-9 items-center justify-center rounded-full transition disabled:opacity-40 ${
              isMicMuted
                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                : 'bg-slate-900 text-white hover:bg-slate-700'
            }`}
            aria-label={isMicMuted ? '마이크 켜기' : '마이크 끄기'}
          >
            <TierMakerIcon name={isMicMuted ? 'micOff' : 'mic'} size={17} />
          </button>
          <button
            type="button"
            onClick={onToggleSpeaker}
            disabled={voiceControlsDisabled}
            aria-pressed={isSpeakerMuted}
            className={`flex size-9 items-center justify-center rounded-full transition disabled:opacity-40 ${
              isSpeakerMuted
                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            aria-label={isSpeakerMuted ? '스피커 켜기' : '스피커 끄기'}
          >
            <TierMakerIcon
              name={isSpeakerMuted ? 'speakerOff' : 'speaker'}
              size={17}
            />
          </button>
      </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}

export default ParticipantDock
