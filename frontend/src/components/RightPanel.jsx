import { TABS } from '../tabs'

export default function RightPanel({ activeTab, collapsed, onToggle }) {
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
        <div className="text-sm text-text-muted leading-relaxed">
          The <span className="text-text-primary">{label.toLowerCase()}</span> panel
          updates as you run queries in the center.
        </div>
      </div>
    </aside>
  )
}
