// Thin wrapper around fetch — every endpoint maps 1:1 to backend/main.py.
// API base is overridable via VITE_API_BASE so the same build can point at a
// deployed backend later without touching the components.

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.json()).detail || ''
    } catch {
      detail = await res.text()
    }
    throw new Error(`${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`)
  }
  return res.json()
}

export const api = {
  listPapers: () => request('/papers'),
  uploadPaper: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return request('/papers/upload', { method: 'POST', body: fd })
  },
  deletePaper: (paperId) =>
    request(`/papers/${encodeURIComponent(paperId)}`, { method: 'DELETE' }),
  arxivSearch: (q, maxResults = 5) =>
    request(`/arxiv/search?q=${encodeURIComponent(q)}&max_results=${maxResults}`),
  arxivImport: (arxivId) =>
    request(`/arxiv/import/${encodeURIComponent(arxivId)}`, { method: 'POST' }),
}
