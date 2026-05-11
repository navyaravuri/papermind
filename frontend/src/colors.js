// Deterministic colour tag per paper_id so the sidebar dot stays stable
// across reloads without us storing colour in the backend.
const PALETTE = [
  '#7c6af7', // accent purple
  '#22c55e', // green
  '#f97316', // orange
  '#06b6d4', // cyan
  '#eab308', // yellow
  '#ec4899', // pink
  '#3b82f6', // blue
  '#a855f7', // violet
]

export function colorForPaper(paperId) {
  let h = 0
  for (let i = 0; i < paperId.length; i++) {
    h = (h * 31 + paperId.charCodeAt(i)) >>> 0
  }
  return PALETTE[h % PALETTE.length]
}
