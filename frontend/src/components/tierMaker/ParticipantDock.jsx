import TierMakerIcon from '@/components/tierMaker/TierMakerIcon'

const participants = [
  {
    id: 1,
    name: '김지수',
    role: '방장 · 나',
    initials: '지수',
    color: 'bg-violet-100 text-violet-700',
    status: '선택 중',
    statusColor: 'bg-emerald-400',
    speaking: true,
    muted: false,
  },
  {
    id: 2,
    name: '이민준',
    role: '참여자',
    initials: '민준',
    color: 'bg-blue-100 text-blue-700',
    status: '드래그 중',
    statusColor: 'bg-violet-400',
    speaking: false,
    muted: false,
  },
  {
    id: 3,
    name: '박서연',
    role: '참여자',
    initials: '서연',
    color: 'bg-rose-100 text-rose-700',
    status: '구경 중',
    statusColor: 'bg-slate-300',
    speaking: false,
    muted: true,
  },
  {
    id: 4,
    name: '최도윤',
    role: '참여자',
    initials: '도윤',
    color: 'bg-amber-100 text-amber-700',
    status: '피팅 중',
    statusColor: 'bg-amber-400',
    speaking: false,
    muted: false,
  },
]

function ParticipantDock({
  isMicMuted,
  isSpeakerMuted,
  onToggleMic,
  onToggleSpeaker,
}) {
  return (
    <section className="mt-5 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.05)] lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3 overflow-x-auto pb-1 lg:pb-0">
        <div className="mr-1 hidden shrink-0 border-r border-slate-200 pr-4 sm:block">
          <p className="text-xs font-bold text-slate-800">참여자</p>
          <p className="mt-1 text-[11px] text-slate-400">4 / 4명</p>
        </div>
        {participants.map((participant) => (
          <div
            key={participant.id}
            className={`flex min-w-[150px] items-center gap-2.5 rounded-2xl border px-3 py-2 ${
              participant.speaking
                ? 'border-emerald-300 bg-emerald-50/50 ring-2 ring-emerald-100'
                : 'border-slate-100 bg-slate-50'
            }`}
          >
            <div
              className={`relative flex size-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${participant.color}`}
            >
              {participant.initials}
              <span
                className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white ${participant.statusColor}`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-800">
                {participant.name}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-slate-400">
                {participant.status}
              </p>
            </div>
            <span
              className={
                participant.muted ? 'text-slate-300' : 'text-emerald-500'
              }
            >
              <TierMakerIcon
                name={participant.muted ? 'micOff' : 'mic'}
                size={14}
              />
            </span>
          </div>
        ))}
      </div>

      <div className="flex shrink-0 items-center justify-center gap-2 border-t border-slate-100 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
        <button
          type="button"
          onClick={onToggleMic}
          aria-pressed={isMicMuted}
          className={`flex size-11 items-center justify-center rounded-full transition ${
            isMicMuted
              ? 'bg-red-100 text-red-600 hover:bg-red-200'
              : 'bg-slate-900 text-white hover:bg-slate-700'
          }`}
          aria-label={isMicMuted ? '마이크 켜기' : '마이크 끄기'}
        >
          <TierMakerIcon name={isMicMuted ? 'micOff' : 'mic'} size={19} />
        </button>
        <button
          type="button"
          onClick={onToggleSpeaker}
          aria-pressed={isSpeakerMuted}
          className={`flex size-11 items-center justify-center rounded-full transition ${
            isSpeakerMuted
              ? 'bg-red-100 text-red-600 hover:bg-red-200'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
          aria-label={isSpeakerMuted ? '스피커 켜기' : '스피커 끄기'}
        >
          <TierMakerIcon
            name={isSpeakerMuted ? 'speakerOff' : 'speaker'}
            size={19}
          />
        </button>
      </div>
    </section>
  )
}

export default ParticipantDock
