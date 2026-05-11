import { TABS } from '../tabs'

export default function Tabs({ activeTab, onChange }) {
  return (
    <div className="flex items-center gap-1 px-6 pt-4 border-b border-border bg-bg/80 backdrop-blur">
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
  )
}
