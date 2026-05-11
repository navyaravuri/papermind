import { colorForPaper } from '../colors'

// Compact checkbox grid for picking which papers a query should hit.
// Shared by Deep Dive and Agent tabs.
export default function PaperCheckboxList({ papers, selected, onChange, label = 'Papers' }) {
  function toggle(id) {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id))
    } else {
      onChange([...selected, id])
    }
  }

  const allIds = papers.map((p) => p.paper_id)
  const allOn = selected.length === allIds.length && allIds.length > 0
  const noneOn = selected.length === 0

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-wider text-text-muted">
          {label} ({selected.length}/{papers.length})
        </div>
        <div className="flex gap-3 text-[11px] font-medium">
          <button
            type="button"
            onClick={() => onChange(allIds)}
            disabled={allOn}
            className="text-accent hover:text-accent-hover disabled:opacity-40 disabled:cursor-default transition-colors"
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={noneOn}
            className="text-text-muted hover:text-text-primary disabled:opacity-40 disabled:cursor-default transition-colors"
          >
            None
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {papers.map((p) => {
          const checked = selected.includes(p.paper_id)
          return (
            <label
              key={p.paper_id}
              className={`flex items-center gap-2 card px-2.5 py-2 cursor-pointer transition-colors ${
                checked
                  ? 'border-accent/60 bg-accent/5'
                  : 'hover:border-accent/30'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(p.paper_id)}
                className="accent-accent w-3.5 h-3.5"
              />
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: colorForPaper(p.paper_id) }}
                aria-hidden="true"
              />
              <span className="text-xs truncate flex-1" title={p.title}>
                {p.title}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
