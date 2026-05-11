import { useState } from 'react'
import { colorForPaper } from '../colors'

export default function SubquestionTree({ data, papers }) {
  if (!data) {
    return (
      <div className="text-text-muted text-sm leading-relaxed">
        Run a query to see the sub-question breakdown here.
      </div>
    )
  }

  const subquestions = data.subquestions || []

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2 font-mono">
          Sub-questions ({subquestions.length})
        </div>
        {subquestions.length === 0 ? (
          <div className="text-sm text-text-muted">
            No sub-questions were generated for this query.
          </div>
        ) : (
          <ul className="space-y-2">
            {subquestions.map((s, i) => (
              <SubquestionCard
                key={i}
                index={i + 1}
                subquestion={s}
                papers={papers}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="pt-3 border-t border-border">
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2 font-mono">
          Synthesised answer
        </div>
        <div className="card p-3 text-xs leading-relaxed whitespace-pre-wrap break-words">
          {data.answer || '—'}
        </div>
      </div>
    </div>
  )
}

function SubquestionCard({ index, subquestion, papers }) {
  const [open, setOpen] = useState(true)

  const paperId = subquestion.paper_id || subquestion.tool_name
  const paper = papers.find((p) => p.paper_id === paperId)
  const paperTitle = paper?.title || paperId || 'unknown'

  return (
    <li className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-accent/5 transition-colors"
        aria-expanded={open}
      >
        <span className="text-[10px] text-text-muted font-mono mt-0.5">
          {String(index).padStart(2, '0')}
        </span>
        <span className="flex-1 text-xs leading-snug">
          {subquestion.question || '(no sub-question text)'}
        </span>
        <span
          className={`text-text-muted text-xs select-none transition-transform ${
            open ? 'rotate-90' : ''
          }`}
          aria-hidden="true"
        >
          ›
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/60">
          {paperId && (
            <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: colorForPaper(paperId) }}
                aria-hidden="true"
              />
              <span className="truncate">{paperTitle}</span>
            </div>
          )}
          <div className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap break-words">
            {subquestion.answer || '—'}
          </div>
        </div>
      )}
    </li>
  )
}
