import { useEffect } from 'react'
import { api } from '../api'
import { runChatTurn } from '../chatActions'
import ChatPanel from './ChatPanel'
import NudgeBanner from './NudgeBanner'

export default function AskPaperTab({
  papers,
  messages,
  onMessagesChange,
  onRightPanelData,
  onJournalEntry,
  arxivOn,
  onArxivSearch,
  // Lifted to App so the dropdown selection survives tab remounts
  // (the tab-fade animation re-keys this subtree on activation).
  paperId,
  onPaperIdChange,
}) {
  const setPaperId = onPaperIdChange

  // Keep the selection valid when papers are added/removed in the sidebar.
  useEffect(() => {
    if (paperId && !papers.some((p) => p.paper_id === paperId)) {
      setPaperId(papers[0]?.paper_id || '')
    } else if (!paperId && papers.length > 0) {
      setPaperId(papers[0].paper_id)
    }
  }, [papers, paperId, setPaperId])

  if (papers.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-8 text-center">
        <div className="max-w-sm text-text-muted text-sm leading-relaxed">
          Upload a PDF or import a paper from arXiv in the sidebar to start asking questions.
        </div>
      </div>
    )
  }

  function buildAssistantPatch(response) {
    const sources = response.sources || []
    return {
      content: response.answer,
      sources,
      confidence: `Based on ${sources.length} matching passage${sources.length === 1 ? '' : 's'}`,
    }
  }

  function buildPanelData(response, question) {
    return {
      sources: response.sources || [],
      question,
      paperId,
    }
  }

  function submit(question, retryAgainstId) {
    return runChatTurn({
      question,
      setMessages: onMessagesChange,
      apiCall: () => api.queryRag(paperId, question),
      buildAssistantPatch,
      buildPanelData: (resp) => buildPanelData(resp, question),
      setPanelData: onRightPanelData,
      appendJournal: onJournalEntry,
      tabId: 'ask',
      retryPayload: { paperId, question },
      reuseAssistantId: retryAgainstId,
    })
  }

  function handleRetry(message) {
    const payload = message.retry || {}
    const question = payload.question || message.question
    if (!question) return
    // If the paper that produced this message still exists, prefer it.
    if (payload.paperId && papers.some((p) => p.paper_id === payload.paperId)) {
      setPaperId(payload.paperId)
    }
    submit(question, message.id)
  }

  // The nudge banner reads the most recent successful assistant message.
  const lastOk = [...messages].reverse().find(
    (m) => m.role === 'assistant' && m.status === 'ok'
  )
  const lastSourceCount = lastOk?.sources?.length ?? null
  const showNudge =
    arxivOn && lastOk && lastSourceCount !== null && lastSourceCount < 2

  return (
    <div className="flex-1 flex flex-col px-6 pt-4 pb-4 min-h-0">
      <div className="mb-3 flex items-center gap-3 flex-wrap">
        <label
          htmlFor="ask-paper-select"
          className="text-[11px] uppercase tracking-wider text-text-muted"
        >
          Paper
        </label>
        <select
          id="ask-paper-select"
          value={paperId}
          onChange={(e) => setPaperId(e.target.value)}
          className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-accent transition-colors min-w-[260px]"
        >
          {papers.map((p) => (
            <option key={p.paper_id} value={p.paper_id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      {showNudge && (
        <div className="mb-3">
          <NudgeBanner
            message="Limited context found — want to search arXiv?"
            onSearch={() => onArxivSearch?.(lastOk.question || '')}
            searchLabel="Search"
          />
        </div>
      )}

      <ChatPanel
        messages={messages}
        onSubmit={(q) => submit(q)}
        onRetry={handleRetry}
        disabled={!paperId}
        disabledHint="Select a paper first"
        placeholder="Ask a question about this paper."
        emptyHint="Ask a question about the selected paper to see sources here."
      />
    </div>
  )
}
