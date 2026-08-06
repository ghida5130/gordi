export default function ImagePicker({
  label,
  preview,
  onChange,
  compact = false,
}: {
  label: string
  preview: string
  onChange: (file: File) => void
  compact?: boolean
}) {
  return (
    <label className={`image-picker ${compact ? 'compact' : ''}`}>
      {preview ? (
        <img src={preview} alt={`${label} 미리보기`} />
      ) : (
        <span className="picker-empty">
          <b>+</b>
          <small>{label}</small>
        </span>
      )}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onChange(file)
        }}
      />
    </label>
  )
}
