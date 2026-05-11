import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { colorForPaper } from '../colors'

export default function Sidebar({
  papers,
  onUploaded,
  onDeleted,
  onImported,
  arxivOn,
  onArxivOnChange,
  arxivQuery,
  onArxivQueryChange,
  pulseSignals = {},
}) {
  const fileInput = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  // Results/loading/importing are local — they don't need to live in App.
  const [arxivResults, setArxivResults] = useState([])
  const [arxivLoading, setArxivLoading] = useState(false)
  const [arxivImporting, setArxivImporting] = useState(null)

  async function handleFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setUploading(true)
    setError(null)
    try {
      const record = await api.uploadPaper(f)
      onUploaded(record)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      e.target.value = '' // allow re-selecting the same file
    }
  }

  async function handleDelete(paperId) {
    try {
      await api.deletePaper(paperId)
      onDeleted(paperId)
    } catch (err) {
      setError(err.message)
    }
  }

  // Debounce arXiv search so we don't fire on every keystroke.
  useEffect(() => {
    if (!arxivOn || !arxivQuery.trim()) {
      setArxivResults([])
      return
    }
    const id = setTimeout(async () => {
      setArxivLoading(true)
      try {
        const results = await api.arxivSearch(arxivQuery.trim(), 5)
        setArxivResults(results)
      } catch (err) {
        setError(err.message)
      } finally {
        setArxivLoading(false)
      }
    }, 350)
    return () => clearTimeout(id)
  }, [arxivOn, arxivQuery])

  async function handleImport(arxivId) {
    setArxivImporting(arxivId)
    try {
      const record = await api.arxivImport(arxivId)
      onImported(record)
    } catch (err) {
      setError(err.message)
    } finally {
      setArxivImporting(null)
    }
  }

  return (
    <aside className="w-[280px] shrink-0 border-r border-border flex flex-col h-full bg-bg">
      <div className="px-5 pt-5 pb-4 border-b border-border">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold tracking-tight">PaperMind</span>
          <span className="text-text-muted text-xs font-mono">v0.1</span>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        <button
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="btn-accent w-full disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {uploading ? 'Uploading…' : 'Upload PDF'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFile}
        />

        <label className="flex items-center justify-between gap-2 text-sm text-text-muted hover:text-text-primary cursor-pointer transition-colors">
          <span>Search beyond my library</span>
          <input
            type="checkbox"
            checked={arxivOn}
            onChange={(e) => onArxivOnChange(e.target.checked)}
            className="sr-only peer"
          />
          <span className="relative w-9 h-5 bg-border peer-checked:bg-accent rounded-full transition-colors">
            <span className="absolute left-0.5 top-0.5 w-4 h-4 bg-text-primary rounded-full peer-checked:translate-x-4 transition-transform" />
          </span>
        </label>

        {arxivOn && (
          <input
            type="text"
            value={arxivQuery}
            onChange={(e) => onArxivQueryChange(e.target.value)}
            placeholder="Search arXiv…"
            className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
        )}
      </div>

      {error && (
        <div className="mx-4 mt-3 text-xs text-red-400 font-mono break-words">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <PaperList
          papers={papers}
          onDelete={handleDelete}
          pulseSignals={pulseSignals}
        />

        {arxivOn && (
          <ArxivResults
            results={arxivResults}
            loading={arxivLoading}
            query={arxivQuery}
            importingId={arxivImporting}
            onImport={handleImport}
          />
        )}
      </div>
    </aside>
  )
}

function PaperList({ papers, onDelete, pulseSignals }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-text-muted mb-2 px-1">
        Library ({papers.length})
      </div>
      {papers.length === 0 ? (
        <div className="text-sm text-text-muted px-1 leading-relaxed">
          No papers yet. Upload a PDF or import one from arXiv.
        </div>
      ) : (
        <ul className="space-y-2">
          {papers.map((p) => (
            <PaperCard
              key={p.paper_id}
              paper={p}
              pulseCount={pulseSignals?.[p.paper_id] || 0}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function PaperCard({ paper, pulseCount, onDelete }) {
  const [pulsing, setPulsing] = useState(false)

  // Restart the animation whenever the pulse counter increments. We tear
  // off the class first so a second pulse can replay even with the same
  // animation name.
  useEffect(() => {
    if (!pulseCount) return
    setPulsing(false)
    const raf = requestAnimationFrame(() => setPulsing(true))
    const t = setTimeout(() => setPulsing(false), 900)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t)
    }
  }, [pulseCount])

  return (
    <li
      className={`group card p-3 hover:border-accent/50 transition-colors ${
        pulsing ? 'paper-pulse' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1 w-2 h-2 rounded-full shrink-0"
          style={{ background: colorForPaper(paper.paper_id) }}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm leading-snug line-clamp-2">{paper.title}</div>
          <div className="text-[11px] text-text-muted font-mono mt-0.5 truncate">
            {paper.paper_id}
          </div>
        </div>
        <button
          onClick={() => onDelete(paper.paper_id)}
          className="btn-ghost opacity-0 group-hover:opacity-100 text-lg leading-none px-1"
          title="Remove paper"
          aria-label={`Remove ${paper.title}`}
        >
          ×
        </button>
      </div>
    </li>
  )
}

function ArxivResults({ results, loading, query, importingId, onImport }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-text-muted mb-2 px-1">
        arXiv {loading ? '· searching…' : results.length ? `· ${results.length} hits` : ''}
      </div>
      {!query.trim() ? (
        <div className="text-sm text-text-muted px-1 leading-relaxed">
          Type to search arXiv.
        </div>
      ) : results.length === 0 && !loading ? (
        <div className="text-sm text-text-muted px-1 leading-relaxed">No results.</div>
      ) : (
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.arxiv_id} className="card p-3">
              <div className="text-sm leading-snug">{r.title}</div>
              <div className="text-[11px] text-text-muted font-mono mt-1 truncate">
                {r.arxiv_id} · {r.authors?.[0] || 'unknown'}
                {r.authors && r.authors.length > 1 ? ' et al.' : ''}
              </div>
              <button
                onClick={() => onImport(r.arxiv_id)}
                disabled={importingId === r.arxiv_id}
                className="mt-2 text-xs text-accent hover:text-accent-hover disabled:opacity-60 transition-colors"
              >
                {importingId === r.arxiv_id ? 'Importing…' : '+ Import'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
