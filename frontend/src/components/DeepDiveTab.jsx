import { api } from '../api'
import SingleshotForm from './SingleshotForm'

export default function DeepDiveTab({
  papers,
  state,
  patchState,
  setRightPanelData,
  addJournalEntry,
}) {
  async function submit({ paperIds, question }) {
    patchState({
      status: 'loading',
      error: null,
      lastQuestion: question,
      lastPaperIds: paperIds,
    })
    try {
      const response = await api.querySubquestion(paperIds, question)
      patchState({ status: 'ok', response })
      setRightPanelData({ ...response, papers, animationKey: Date.now() })
      addJournalEntry({ tab: 'deepdive', question, answer: response.answer || '' })
    } catch (err) {
      patchState({ status: 'error', error: err.message })
    }
  }

  function retry() {
    if (state.lastPaperIds && state.lastQuestion) {
      submit({ paperIds: state.lastPaperIds, question: state.lastQuestion })
    }
  }

  return (
    <SingleshotForm
      papers={papers}
      state={state}
      patchState={patchState}
      onSubmit={submit}
      questionPlaceholder="Ask a comparative or multi-faceted question that needs more than one paper."
      submitLabel="Decompose"
      loadingLabel="Decomposing…"
      description="The engine will break this into focused sub-questions, hit each paper individually, and synthesise a final answer."
      renderResult={({ status, state: s }) => (
        <DeepDiveResult status={status} state={s} onRetry={retry} />
      )}
    />
  )
}

function DeepDiveResult({ status, state, onRetry }) {
  if (status === 'idle') return null

  if (status === 'loading') {
    return (
      <div className="card p-5 flex items-center gap-3 text-text-muted text-sm">
        <ThinkingDots />
        <span>Generating sub-questions and synthesising…</span>
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
  const count = state.response?.subquestions?.length || 0

  return (
    <div className="space-y-3">
      <div className="text-[11px] uppercase tracking-wider text-text-muted font-mono">
        Synthesised answer · {count} sub-question{count === 1 ? '' : 's'}
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
