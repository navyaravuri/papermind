// Single source of truth for tab metadata: id, label, and the matching
// right-panel header so the App doesn't need switch statements scattered
// across sub-components.

export const TABS = [
  { id: 'ask', label: 'Ask a Paper', panel: 'Sources' },
  { id: 'router', label: 'Smart Router', panel: 'Routing' },
  { id: 'deepdive', label: 'Deep Dive', panel: 'Breakdown' },
  { id: 'agent', label: 'Agent', panel: 'Reasoning Trace' },
  { id: 'network', label: 'Paper Network', panel: 'Contributions' },
  { id: 'figure', label: 'Figure Reader', panel: 'Figure Context' },
]

export const DEFAULT_TAB = TABS[0].id
