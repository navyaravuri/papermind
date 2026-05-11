import { TABS } from '../tabs'

export default function Tabs({ activeTab, onChange, onOpenJournal, journalCount }) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 pt-4 border-b border-border bg-bg/80 backdrop-blur">
      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map((t) => {
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`px-3 py-2 text-sm font-medium rounded-t-md transition-colors border-b-2 ${
                active
                  ? 'text-text-primary border-accent'
                  : 'text-text-muted border-transparent hover:text-text-primary'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <button
        onClick={onOpenJournal}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-muted hover:text-text-primary rounded-md border border-transparent hover:border-border transition-colors -mt-1"
        title="Open research journal"
        aria-label="Open research journal"
      >
        <JournalIcon />
        <span>Journal</span>
        {journalCount > 0 && (
          <span className="bg-accent text-white text-[10px] font-mono px-1.5 py-0.5 rounded-md leading-none">
            {journalCount}
          </span>
        )}
      </button>
    </div>
  )
}

function JournalIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
      <path d="M9 7h7" />
      <path d="M9 11h7" />
    </svg>
  )
}
