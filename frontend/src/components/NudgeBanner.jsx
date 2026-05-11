// Shared arXiv nudge banner used by tabs that detect "limited context"
// signals. The button is optional — when no `onSearch` is given the
// banner becomes informational.
export default function NudgeBanner({ message, onSearch, searchLabel = 'Search arXiv' }) {
  return (
    <div className="card border-accent/40 bg-accent/5 px-3 py-2.5 text-sm flex items-center justify-between gap-3">
      <span className="leading-snug">{message}</span>
      {onSearch && (
        <button
          type="button"
          onClick={() => onSearch()}
          className="btn-accent text-xs !px-3 !py-1.5 shrink-0"
        >
          {searchLabel}
        </button>
      )}
    </div>
  )
}
