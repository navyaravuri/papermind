import { useRef, useState } from 'react'

// Reused across every tab whose workflow needs at least one paper.
// Has its own file input + arXiv toggle button so the user doesn't have
// to chase the sidebar from the center area.
export default function EmptyLibraryState({
  onUploadFile,
  onSearchArxiv,
  title = 'Your library is empty',
  subtitle = 'Upload a PDF, or pull one in from arXiv — PaperMind needs at least one paper to query.',
}) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setError(null)
    setBusy(true)
    try {
      await onUploadFile(f)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-8 py-12">
      <div className="max-w-sm w-full text-center">
        <Illustration />
        <h3 className="text-lg font-semibold mt-5 mb-2">{title}</h3>
        <p className="text-text-muted text-sm leading-relaxed mb-6">
          {subtitle}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="btn-accent text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? 'Uploading…' : 'Upload PDF'}
          </button>
          {onSearchArxiv && (
            <button
              type="button"
              onClick={onSearchArxiv}
              className="text-sm text-accent hover:text-accent-hover transition-colors"
            >
              Search arXiv →
            </button>
          )}
        </div>
        {error && (
          <div className="mt-4 text-xs text-red-400 font-mono break-words">
            {error}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  )
}

function Illustration() {
  return (
    <svg
      width="76"
      height="76"
      viewBox="0 0 64 64"
      fill="none"
      className="mx-auto text-text-muted"
      aria-hidden="true"
    >
      <rect
        x="11"
        y="9"
        width="36"
        height="46"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="17"
        y="15"
        width="36"
        height="46"
        rx="3"
        fill="#1a1a1a"
        stroke="#7c6af7"
        strokeWidth="1.6"
      />
      <line
        x1="22"
        y1="24"
        x2="42"
        y2="24"
        stroke="#7c6af7"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <line
        x1="22"
        y1="30"
        x2="46"
        y2="30"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.6"
      />
      <line
        x1="22"
        y1="36"
        x2="46"
        y2="36"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.6"
      />
      <line
        x1="22"
        y1="42"
        x2="38"
        y2="42"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  )
}
