import { api } from '../api'

export default function PaperNetworkTab({
  papers,
  state,
  patchState,
  setRightPanelData,
  addJournalEntry,
}) {
  const question = state.question || ''
  const status = state.status || 'idle'

  async function submit() {
    const q = question.trim()
    if (!q || papers.length === 0) return
    patchState({ status: 'loading', error: null, lastQuestion: q })
    try {
      const response = await api.queryMultidoc(q)
      patchState({ status: 'ok', response })
      setRightPanelData({
        ...response,
        question: q,
        papers,
        animationKey: Date.now(),
      })
      addJournalEntry({
        tab: 'network',
        question: q,
        answer: response.answer || '',
      })
    } catch (err) {
      patchState({ status: 'error', error: err.message })
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
  }

  function retry() {
    if (state.lastQuestion) {
      patchState({ question: state.lastQuestion })
      // submit reads state on next render — call directly with closure-safe values
      submitWith(state.lastQuestion)
    }
  }

  async function submitWith(q) {
    patchState({ status: 'loading', error: null, lastQuestion: q })
    try {
      const response = await api.queryMultidoc(q)
      patchState({ status: 'ok', response })
      setRightPanelData({
        ...response,
        question: q,
        papers,
        animationKey: Date.now(),
      })
      addJournalEntry({ tab: 'network', question: q, answer: response.answer || '' })
    } catch (err) {
      patchState({ status: 'error', error: err.message })
    }
  }

  if (papers.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-8 text-center">
        <div className="max-w-sm text-text-muted text-sm leading-relaxed">
          Upload at least one paper to query the network.
        </div>
      </div>
    )
  }

  const canSubmit = status !== 'loading' && question.trim().length > 0

  return (
    <div className="flex-1 flex flex-col px-6 pt-4 pb-4 min-h-0 overflow-y-auto">
      <p className="text-xs text-text-muted mb-3 leading-relaxed">
        Queries your entire library at once ({papers.length}{' '}
        paper{papers.length === 1 ? '' : 's'}). The right panel shows what
        each paper contributed to the answer.
      </p>

      <div className="flex flex-col gap-2 mb-6">
        <textarea
          value={question}
          onChange={(e) => patchState({ question: e.target.value })}
          onKeyDown={handleKey}
          rows={3}
          placeholder="Ask a synthesis question across your library."
          className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-y"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] text-text-muted font-mono">
            ⌘/Ctrl + Enter to submit
          </div>
          <button
            type="button"
            onClick={() => submit()}
            disabled={!canSubmit}
            className="btn-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? 'Searching network…' : 'Run network'}
          </button>
        </div>
      </div>

      <NetworkResult status={status} state={state} onRetry={retry} />
    </div>
  )
}

function NetworkResult({ status, state, onRetry }) {
  if (status === 'idle') return null

  if (status === 'loading') {
    return (
      <div className="card p-5 flex items-center gap-3 text-text-muted text-sm">
        <ThinkingDots />
        <span>Routing across every paper in your library…</span>
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
  const count = state.response?.sources?.length || 0

  return (
    <div className="space-y-3">
      <div className="text-[11px] uppercase tracking-wider text-text-muted font-mono">
        Synthesised answer · {count} paper{count === 1 ? '' : 's'} contributed
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
