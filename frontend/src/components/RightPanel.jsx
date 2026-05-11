import { TABS } from '../tabs'
import { colorForPaper } from '../colors'

export default function RightPanel({
  activeTab,
  panelData,
  papers,
  collapsed,
  onToggle,
}) {
  const tab = TABS.find((t) => t.id === activeTab)
  const label = tab?.panel || 'Context'

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        title="Show context panel"
        className="w-8 shrink-0 border-l border-border flex items-start justify-center pt-4 text-text-muted hover:text-text-primary transition-colors"
        aria-label="Expand context panel"
      >
        <span className="rotate-180 select-none">›</span>
      </button>
    )
  }

  const data = panelData[activeTab]

  return (
    <aside className="w-[320px] shrink-0 border-l border-border flex flex-col h-full bg-bg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-[11px] uppercase tracking-wider text-text-muted">
          {label}
        </span>
        <button
          onClick={onToggle}
          className="btn-ghost text-lg leading-none px-1"
          aria-label="Collapse context panel"
          title="Hide context panel"
        >
          ›
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <PanelContent activeTab={activeTab} data={data} papers={papers} />
      </div>
    </aside>
  )
}

function PanelContent({ activeTab, data, papers }) {
  if (!data) {
    return (
      <div className="text-text-muted text-sm leading-relaxed">
        Run a query to see {labelForEmpty(activeTab)} here.
      </div>
    )
  }
  if (activeTab === 'ask') {
    return <SourcesList sources={data.sources || []} />
  }
  if (activeTab === 'router') {
    return (
      <RoutingDecision
        selectedPaper={data.selectedPaper}
        reason={data.routingReason}
        papers={papers}
      />
    )
  }
  return (
    <div className="text-text-muted text-sm">This tab is not wired yet.</div>
  )
}

function labelForEmpty(activeTab) {
  switch (activeTab) {
    case 'ask':
      return 'source passages'
    case 'router':
      return 'routing decisions'
    case 'deepdive':
      return 'the sub-question breakdown'
    case 'agent':
      return 'reasoning steps'
    case 'network':
      return 'cross-paper contributions'
    case 'figure':
      return 'figure context'
    default:
      return 'context'
  }
}

function SourcesList({ sources }) {
  if (sources.length === 0) {
    return (
      <div className="text-text-muted text-sm">No source passages returned.</div>
    )
  }
  return (
    <div className="space-y-2">
      <div className="text-[11px] text-text-muted font-mono mb-2">
        {sources.length} passage{sources.length === 1 ? '' : 's'}
      </div>
      {sources.map((s, i) => (
        <div key={i} className="card p-3">
          {s.page != null && (
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1 font-mono">
              Page {s.page}
            </div>
          )}
          <div className="text-xs leading-relaxed text-text-primary whitespace-pre-wrap break-words">
            {s.text}
          </div>
        </div>
      ))}
    </div>
  )
}

function RoutingDecision({ selectedPaper, reason, papers }) {
  const paper = papers.find((p) => p.paper_id === selectedPaper)
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5 font-mono">
          Selected paper
        </div>
        <div className="card p-3 flex items-center gap-2">
          {selectedPaper && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: colorForPaper(selectedPaper) }}
              aria-hidden="true"
            />
          )}
          <div className="text-sm leading-snug">
            {paper?.title || selectedPaper || '—'}
          </div>
        </div>
      </div>
      {reason && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5 font-mono">
            Routing reasoning
          </div>
          <blockquote className="border-l-2 border-accent pl-3 text-sm text-text-primary leading-relaxed italic">
            {reason}
          </blockquote>
        </div>
      )}
    </div>
  )
}
