import { useRef, useState } from 'react'
import { api } from '../api'

export default function FigureReaderTab({
  papers,
  state,
  patchState,
  setRightPanelData,
  addJournalEntry,
}) {
  const fileRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const {
    imageFile = null,
    imagePreview = null,
    imageFileName = '',
    paperId = '',
    question = '',
    saveToIndex = false,
    status = 'idle',
    response = null,
    error = null,
  } = state

  function loadFile(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      patchState({ error: 'That file is not an image.' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      patchState({
        imageFile: file,
        imagePreview: reader.result,
        imageFileName: file.name,
        error: null,
      })
    }
    reader.readAsDataURL(file)
  }

  function clearImage() {
    patchState({ imageFile: null, imagePreview: null, imageFileName: '' })
  }

  async function submit() {
    if (!imageFile || !question.trim()) return
    const includePaper = !!(saveToIndex && paperId)
    const trimmed = question.trim()
    patchState({ status: 'loading', error: null, lastQuestion: trimmed })
    try {
      const result = await api.queryMultimodal({
        image: imageFile,
        question: trimmed,
        paperId: includePaper ? paperId : null,
      })
      const savedTitle = includePaper
        ? papers.find((p) => p.paper_id === paperId)?.title || paperId
        : null
      patchState({ status: 'ok', response: result, savedPaperTitle: savedTitle })
      setRightPanelData({
        description: result.description,
        savedPaperTitle: savedTitle,
        animationKey: Date.now(),
      })
      addJournalEntry({
        tab: 'figure',
        question: trimmed,
        answer: result.answer || '',
      })
    } catch (err) {
      patchState({ status: 'error', error: err.message })
    }
  }

  function retry() {
    if (imageFile && state.lastQuestion) {
      patchState({ question: state.lastQuestion })
      submit()
    }
  }

  const canSubmit =
    status !== 'loading' && imageFile && question.trim().length > 0

  return (
    <div className="flex-1 flex flex-col px-6 pt-4 pb-4 min-h-0 overflow-y-auto">
      <p className="text-xs text-text-muted mb-3 leading-relaxed">
        Drop a figure (architecture diagram, plot, table screenshot) and ask
        Gemini what it shows. Link a paper to save the description back to its
        index.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <DropZone
          imagePreview={imagePreview}
          imageFileName={imageFileName}
          dragOver={dragOver}
          fileRef={fileRef}
          onPick={() => fileRef.current?.click()}
          onChangeFile={(f) => loadFile(f)}
          onClear={clearImage}
          onDragEnter={() => setDragOver(true)}
          onDragLeave={() => setDragOver(false)}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            loadFile(e.dataTransfer.files?.[0])
          }}
        />

        <div className="flex flex-col gap-3">
          <div>
            <label
              htmlFor="figure-paper-select"
              className="text-[11px] uppercase tracking-wider text-text-muted block mb-1.5"
            >
              Linked paper (optional)
            </label>
            <select
              id="figure-paper-select"
              value={paperId}
              onChange={(e) => patchState({ paperId: e.target.value })}
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
            >
              <option value="">— None —</option>
              {papers.map((p) => (
                <option key={p.paper_id} value={p.paper_id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 flex flex-col">
            <label
              htmlFor="figure-question"
              className="text-[11px] uppercase tracking-wider text-text-muted block mb-1.5"
            >
              Question
            </label>
            <textarea
              id="figure-question"
              value={question}
              onChange={(e) => patchState({ question: e.target.value })}
              rows={4}
              placeholder="What does this figure show? What dimensions are labelled?"
              className="flex-1 bg-surface border border-border rounded-md px-3 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] text-text-muted">
              {paperId
                ? saveToIndex
                  ? 'Will be saved to the linked paper on submit.'
                  : 'Toggle Save in the right panel to add to the paper.'
                : 'No paper linked — description won\'t be persisted.'}
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="btn-accent disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {status === 'loading' ? 'Reading…' : 'Read figure'}
            </button>
          </div>
        </div>
      </div>

      <FigureResult status={status} state={state} onRetry={retry} />
    </div>
  )
}

function DropZone({
  imagePreview,
  imageFileName,
  dragOver,
  fileRef,
  onPick,
  onChangeFile,
  onClear,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
}) {
  return (
    <div
      onClick={!imagePreview ? onPick : undefined}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`card flex flex-col items-center justify-center gap-2 p-5 min-h-[220px] text-center transition-colors ${
        imagePreview ? '' : 'cursor-pointer border-dashed'
      } ${dragOver ? 'border-accent bg-accent/5' : ''}`}
    >
      {imagePreview ? (
        <>
          <img
            src={imagePreview}
            alt={imageFileName}
            className="max-h-[160px] max-w-full rounded border border-border object-contain"
          />
          <div
            className="text-[11px] text-text-muted font-mono truncate max-w-full"
            title={imageFileName}
          >
            {imageFileName}
          </div>
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={onPick}
              className="text-accent hover:text-accent-hover transition-colors"
            >
              Replace
            </button>
            <span className="text-border">·</span>
            <button
              type="button"
              onClick={onClear}
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              Remove
            </button>
          </div>
        </>
      ) : (
        <>
          <UploadIcon />
          <div className="text-sm text-text-muted">
            Drop a figure here, or click to upload
          </div>
          <div className="text-[11px] text-text-muted/70">PNG, JPG, screenshot</div>
        </>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onChangeFile(e.target.files?.[0])}
      />
    </div>
  )
}

function UploadIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-text-muted"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function FigureResult({ status, state, onRetry }) {
  if (status === 'idle') return null

  if (status === 'loading') {
    return (
      <div className="card p-5 flex items-center gap-3 text-text-muted text-sm">
        <ThinkingDots />
        <span>Looking at the image with Gemini…</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="card border-red-500/40 bg-red-500/5 p-4 text-sm">
        <div className="text-red-300 mb-2 font-mono text-xs break-words">
          {state.error || 'Request failed'}
        </div>
        <button
          onClick={onRetry}
          className="text-xs text-accent hover:text-accent-hover transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  const answer = state.response?.answer || ''
  return (
    <div className="space-y-3">
      <div className="text-[11px] uppercase tracking-wider text-text-muted font-mono">
        Answer
      </div>
      <div className="card p-5 text-sm leading-relaxed whitespace-pre-wrap">
        {answer}
      </div>
    </div>
  )
}

function ThinkingDots() {
  return (
    <span className="inline-flex gap-1" aria-hidden="true">
      <span
        className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"
        style={{ animationDelay: '0ms' }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"
        style={{ animationDelay: '150ms' }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"
        style={{ animationDelay: '300ms' }}
      />
    </span>
  )
}
