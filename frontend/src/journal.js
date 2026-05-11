// Helpers for the Research Journal. The entries themselves live in React
// state in App; this module is just pure utilities so the drawer component
// stays declarative.

export function entriesToMarkdown(entries, tabLabels = {}) {
  if (!entries.length) {
    return '# PaperMind Research Journal\n\n_No entries yet._\n'
  }
  const exported = new Date().toLocaleString()
  const lines = ['# PaperMind Research Journal', '', `_Exported ${exported}_`, '', '']
  entries.forEach((e, i) => {
    const when = new Date(e.ts).toLocaleString()
    const tabName = tabLabels[e.tab] || e.tab
    lines.push(`## ${i + 1}. ${tabName} — ${when}`)
    lines.push('')
    lines.push(`**Q:** ${e.question}`)
    lines.push('')
    lines.push(`**A:** ${e.answer}`)
    lines.push('')
    lines.push('---')
    lines.push('')
  })
  return lines.join('\n')
}

export function downloadMarkdown(text, filename = 'papermind-journal.md') {
  const blob = new Blob([text], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
