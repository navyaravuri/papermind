import { api } from '../api'
import { runChatTurn } from '../chatActions'
import ChatPanel from './ChatPanel'
import NudgeBanner from './NudgeBanner'

export default function SmartRouterTab({
  papers,
  messages,
  onMessagesChange,
  onRightPanelData,
  onJournalEntry,
  arxivOn,
  onArxivSearch,
}) {
  if (papers.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-8 text-center">
        <div className="max-w-sm text-text-muted text-sm leading-relaxed">
          Upload at least one paper to use the router.
        </div>
      </div>
    )
  }

  const paperIds = papers.map((p) => p.paper_id)

  function buildAssistantPatch(response) {
    return { content: response.answer }
  }

  function buildPanelData(response) {
    return {
      selectedPaper: response.selected_paper,
      routingReason: response.routing_reason,
    }
  }

  function submit(question, retryAgainstId) {
    // Snapshot the paper set at submit time so a deletion mid-flight doesn't
    // change what the retry would re-send.
    const idsAtSubmit = [...paperIds]
    return runChatTurn({
      question,
      setMessages: onMessagesChange,
      apiCall: () => api.queryRouter(idsAtSubmit, question),
      buildAssistantPatch,
      buildPanelData,
      setPanelData: onRightPanelData,
      appendJournal: onJournalEntry,
      tabId: 'router',
      retryPayload: { question, paperIds: idsAtSubmit },
      reuseAssistantId: retryAgainstId,
    })
  }

  function handleRetry(message) {
    const question = message.retry?.question || message.question
    if (question) submit(question, message.id)
  }

  // The router only adds value across 2+ papers — if the library is smaller
  // than that and arXiv search is enabled, surface the nudge.
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
  const showNudge = arxivOn && papers.length < 2

  return (
    <div className="flex-1 flex flex-col px-6 pt-4 pb-4 min-h-0">
      <div className="mb-3 text-xs text-text-muted">
        Routing across {papers.length} paper{papers.length === 1 ? '' : 's'} —
        the router picks the most relevant one for each question.
      </div>
      {showNudge && (
        <div className="mb-3">
          <NudgeBanner
            message="With one paper, the router can't really route. Add more papers or search arXiv."
            onSearch={() => onArxivSearch?.(lastUserMsg?.content || '')}
            searchLabel="Search"
          />
        </div>
      )}
      <ChatPanel
        messages={messages}
        onSubmit={(q) => submit(q)}
        onRetry={handleRetry}
        placeholder="Ask a question. The router picks the right paper."
        emptyHint="Ask anything — the router will choose which paper to consult."
      />
    </div>
  )
}
