import { useEffect } from 'react'
import PaperCheckboxList from './PaperCheckboxList'

// Shared scaffolding for one-shot query tabs (Deep Dive, Agent): paper
// selector + question textarea + submit. The tab passes a `renderResult`
// function for whatever lives below the form.
export default function SingleshotForm({
  papers,
  state,
  patchState,
  onSubmit,
  questionPlaceholder,
  submitLabel = 'Run',
  loadingLabel = 'Thinking…',
  description,
  renderResult,
}) {
  const paperIds = state.paperIds ?? null
  const question = state.question ?? ''
  const status = state.status || 'idle'

  // Initialise selection to all papers on first mount, and prune any ids
  // that no longer exist after a delete.
  useEffect(() => {
    if (paperIds == null) {
      patchState({ paperIds: papers.map((p) => p.paper_id) })
      return
    }
    const valid = paperIds.filter((id) => papers.some((p) => p.paper_id === id))
    if (valid.length !== paperIds.length) {
      patchState({ paperIds: valid })
    }
  }, [papers, paperIds, patchState])

  const effectivePaperIds = paperIds ?? papers.map((p) => p.paper_id)
  const canSubmit =
    status !== 'loading' &&
    question.trim().length > 0 &&
    effectivePaperIds.length > 0

  function handleSubmit(e) {
    e?.preventDefault()
    if (!canSubmit) return
    onSubmit({ paperIds: effectivePaperIds, question: question.trim() })
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit()
    }
  }

  if (papers.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-8 text-center">
        <div className="max-w-sm text-text-muted text-sm leading-relaxed">
          Upload at least one paper to use this tab.
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col px-6 pt-4 pb-4 min-h-0 overflow-y-auto">
      {description && (
        <p className="text-xs text-text-muted mb-3 leading-relaxed">
          {description}
        </p>
      )}

      <PaperCheckboxList
        papers={papers}
        selected={effectivePaperIds}
        onChange={(ids) => patchState({ paperIds: ids })}
      />

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2">
        <textarea
          value={question}
          onChange={(e) => patchState({ question: e.target.value })}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder={questionPlaceholder || 'Ask a question.'}
          className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-y"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] text-text-muted font-mono">
            ⌘/Ctrl + Enter to submit
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? loadingLabel : submitLabel}
          </button>
        </div>
      </form>

      <div className="mt-6">{renderResult({ status, state })}</div>
    </div>
  )
}
