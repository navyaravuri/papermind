import { useEffect } from 'react'
import { downloadMarkdown, entriesToMarkdown } from '../journal'

export default function JournalDrawer({ open, onClose, entries, tabLabels }) {
  // Close on Escape so it feels like a real modal/drawer.
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function handleExport() {
    const md = entriesToMarkdown(entries, tabLabels)
    const stamp = new Date().toISOString().slice(0, 10)
    downloadMarkdown(md, `papermind-journal-${stamp}.md`)
  }

  // Newest first in the UI; export keeps chronological order so it reads
  // like a logbook when opened in another editor.
  const ordered = [...entries].reverse()

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed right-0 top-0 bottom-0 w-[440px] max-w-[90vw] bg-bg border-l border-border z-50 flex flex-col shadow-2xl"
        role="dialog"
        aria-label="Research Journal"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <div className="text-sm font-semibold">Research Journal</div>
            <div className="text-[11px] text-text-muted font-mono">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost text-xl leading-none px-1"
            aria-label="Close journal"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-3 border-b border-border">
          <button
            onClick={handleExport}
            disabled={entries.length === 0}
            className="btn-accent text-xs !px-3 !py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export as Markdown
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {entries.length === 0 ? (
            <div className="text-text-muted text-sm leading-relaxed">
              No entries yet. Every question + answer pair you run will be
              recorded here.
            </div>
          ) : (
            ordered.map((e) => (
              <article key={e.id} className="card p-3">
                <header className="flex items-center justify-between text-[10px] text-text-muted font-mono mb-2 uppercase tracking-wider">
                  <span className="text-accent/80">
                    {tabLabels[e.tab] || e.tab}
                  </span>
                  <time dateTime={new Date(e.ts).toISOString()}>
                    {new Date(e.ts).toLocaleString()}
                  </time>
                </header>
                <div className="text-sm font-medium mb-2 leading-snug">
                  {e.question}
                </div>
                <div className="text-xs text-text-muted leading-relaxed whitespace-pre-wrap break-words">
                  {e.answer}
                </div>
              </article>
            ))
          )}
        </div>
      </aside>
    </>
  )
}
