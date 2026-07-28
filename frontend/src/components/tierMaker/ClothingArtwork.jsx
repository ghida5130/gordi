const clothingShapes = {
  jacket: (
    <>
      <path d="M29 20 42 13h20l13 7 12 24-13 7-6-12v50H36V39l-6 12-13-7 12-24Z" fill="currentColor" />
      <path d="m42 13 10 16 10-16M52 29v60M42 48h-6M62 48h6" fill="none" stroke="white" strokeOpacity=".65" strokeWidth="2" />
      <circle cx="56" cy="42" r="1.5" fill="white" />
      <circle cx="56" cy="52" r="1.5" fill="white" />
      <circle cx="56" cy="62" r="1.5" fill="white" />
    </>
  ),
  cardigan: (
    <>
      <path d="M29 21 43 14h18l14 7 11 23-13 6-6-12v50H37V38l-6 12-13-6 11-23Z" fill="currentColor" />
      <path d="m43 14 9 15 9-15M52 29v59" fill="none" stroke="#9A7E68" strokeWidth="2" />
      {[40, 50, 60, 70].map((y) => <circle key={y} cx="56" cy={y} r="1.4" fill="#9A7E68" />)}
    </>
  ),
  shirt: (
    <>
      <path d="m26 24 18-11h16l18 11 10 19-13 7-8-12v51H37V38l-8 12-13-7 10-19Z" fill="currentColor" />
      <path d="m44 13 8 14 8-14 8 6-16 8-16-8 8-6ZM52 27v62" fill="none" stroke="white" strokeOpacity=".75" strokeWidth="2" />
      {[38, 49, 60, 71].map((y) => <circle key={y} cx="56" cy={y} r="1.2" fill="white" />)}
    </>
  ),
  knit: (
    <>
      <path d="m27 23 17-10h16l17 10 11 21-13 7-8-13v51H37V38l-8 13-13-7 11-21Z" fill="currentColor" />
      <path d="M37 38h30M37 48h30M37 58h30M37 68h30M37 78h30" fill="none" stroke="white" strokeOpacity=".65" strokeWidth="3" />
    </>
  ),
  pants: (
    <>
      <path d="M34 12h36l6 77H57l-5-52-5 52H28l6-77Z" fill="currentColor" />
      <path d="M52 14v23M35 24h34M41 13l3 10M63 13l-3 10" fill="none" stroke="white" strokeOpacity=".42" strokeWidth="2" />
      <circle cx="56" cy="18" r="1.5" fill="white" />
    </>
  ),
  skirt: (
    <>
      <path d="M37 13h30l3 12 12 64H22l12-64 3-12Z" fill="currentColor" />
      <path d="M34 25h36M43 26l-6 61M52 26v61M61 26l6 61" fill="none" stroke="white" strokeOpacity=".5" strokeWidth="2" />
    </>
  ),
  loafers: (
    <>
      <path d="M12 58c6-9 16-15 29-15l8 12 3 15H12V58ZM53 58c6-9 16-15 29-15l8 12 3 15H53V58Z" fill="currentColor" />
      <path d="M13 61h38M54 61h38M25 49l17 2M66 49l17 2" fill="none" stroke="white" strokeOpacity=".55" strokeWidth="2" />
    </>
  ),
  sneakers: (
    <>
      <path d="m13 54 10-17 18 13 11 6v14H10l3-16ZM55 54l10-17 18 13 11 6v14H52l3-16Z" fill="currentColor" />
      <path d="M12 62h39M54 62h39M25 45l13 8M67 45l13 8M30 49l4-5M72 49l4-5" fill="none" stroke="#94A3B8" strokeWidth="2" />
    </>
  ),
}

function ClothingArtwork({ item, className = '' }) {
  return (
    <div
      className={`flex items-center justify-center overflow-hidden ${item.surface} ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 104 104"
        className={`h-[88%] w-[88%] drop-shadow-sm ${item.color}`}
      >
        {clothingShapes[item.artwork]}
      </svg>
    </div>
  )
}

export default ClothingArtwork
