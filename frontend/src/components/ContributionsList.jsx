import { colorForPaper } from '../colors'
import NudgeBanner from './NudgeBanner'

export default function ContributionsList({ data, papers, arxivOn, onArxivSearch }) {
  if (!data) {
    return (
      <div className="text-text-muted text-sm leading-relaxed">
        Run a query to see cross-paper contributions here.
      </div>
    )
  }

  const sources = data.sources || []
  const question = data.question || ''

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2 font-mono">
          Contributions ({sources.length})
        </div>
        {sources.length === 0 ? (
          <div className="text-text-muted text-sm">
            No paper-level contributions were captured.
          </div>
        ) : (
          <ul className="space-y-2">
            {sources.map((s, i) => (
              <ContributionCard
                key={`${s.paper_id}-${i}`}
                source={s}
                papers={papers}
              />
            ))}
          </ul>
        )}
      </div>

      {sources.length === 1 && (
        <NudgeBanner
          message="Only one paper contributed — consider adding more papers or searching arXiv."
          onSearch={arxivOn ? () => onArxivSearch?.(question) : undefined}
          searchLabel="Search arXiv"
        />
      )}
    </div>
  )
}

function ContributionCard({ source, papers }) {
  const paper = papers.find((p) => p.paper_id === source.paper_id)
  const title = paper?.title || source.paper_id || 'unknown'
  return (
    <li className="card p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: colorForPaper(source.paper_id || title) }}
          aria-hidden="true"
        />
        <div className="text-xs font-medium leading-snug truncate" title={title}>
          {title}
        </div>
      </div>
      <div className="text-xs text-text-muted leading-relaxed whitespace-pre-wrap break-words">
        {source.contribution || '—'}
      </div>
    </li>
  )
}
