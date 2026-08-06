import { useState } from 'react'
import { createPortal } from 'react-dom'

export default function HoverZoomImage({
  src,
  alt,
}: {
  src: string
  alt: string
}) {
  const [zoomed, setZoomed] = useState(false)

  return (
    <>
      <img
        className="zoomable-image"
        src={src}
        alt={alt}
        tabIndex={0}
        onMouseEnter={() => setZoomed(true)}
        onMouseLeave={() => setZoomed(false)}
        onFocus={() => setZoomed(true)}
        onBlur={() => setZoomed(false)}
      />
      {zoomed && createPortal(
        <div className="image-hover-preview" aria-hidden="true">
          <img src={src} alt="" />
        </div>,
        document.body,
      )}
    </>
  )
}
