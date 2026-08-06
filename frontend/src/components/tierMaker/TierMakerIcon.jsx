const paths = {
  add: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  close: (
    <>
      <path d="m18 6-12 12" />
      <path d="m6 6 12 12" />
    </>
  ),
  columns: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16M15 4v16" />
    </>
  ),
  door: (
    <>
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    </>
  ),
  focus: (
    <>
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
    </>
  ),
  grip: (
    <>
      <circle cx="9" cy="6" r=".7" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r=".7" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r=".7" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r=".7" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r=".7" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r=".7" fill="currentColor" stroke="none" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
    </>
  ),
  micOff: (
    <>
      <path d="m3 3 18 18M9 5.3V5a3 3 0 0 1 5.8-1M15 9.5V11a3 3 0 0 1-.4 1.5M5 10a7 7 0 0 0 11.5 5.4M19 10a7 7 0 0 1-.8 3.2M12 17v5M8 22h8" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3-1.1 3.1L8 7.2l2.9 1.1L12 11l1.1-2.7L16 7.2l-2.9-1.1L12 3Z" />
      <path d="m5.5 12-.8 2.2-2.2.8 2.2.8.8 2.2.8-2.2 2.2-.8-2.2-.8-.8-2.2Z" />
      <path d="m18.5 13-.7 1.8-1.8.7 1.8.7.7 1.8.7-1.8 1.8-.7-1.8-.7-.7-1.8Z" />
    </>
  ),
  speaker: (
    <>
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </>
  ),
  speakerOff: (
    <>
      <path d="M11 5 6 9H2v6h4l5 4V5ZM15 9l6 6M21 9l-6 6" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
}

function TierMakerIcon({ name, size = 20, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths[name]}
    </svg>
  )
}

export default TierMakerIcon
