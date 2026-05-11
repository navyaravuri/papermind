import { TABS } from '../tabs'

const COPY = {
  ask: 'Pick a paper from the sidebar and ask a focused question. Answers stream back with the source chunks shown on the right.',
  router: 'Select two or more papers and let the router decide which paper your question is best answered from.',
  deepdive: 'Comparative questions across multiple papers. The engine decomposes your question into per-paper sub-questions.',
  agent: 'A ReAct agent that can chain retrieval and calculator tools. Reasoning steps appear in the right panel.',
  network: 'Multi-document agent that pulls from every paper in your library and shows each paper\'s contribution.',
  figure: 'Drop in a figure (architecture diagram, plot, table) and ask about it. Gemini multi-modal does the read.',
}

export default function TabPanel({ activeTab }) {
  const tab = TABS.find((t) => t.id === activeTab)
  if (!tab) return null
  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xl font-semibold mb-2">{tab.label}</h2>
        <p className="text-text-muted text-sm leading-relaxed mb-8">{COPY[tab.id]}</p>

        <div className="card border-dashed p-12 text-center text-text-muted text-sm">
          <div className="font-mono text-xs uppercase tracking-wider mb-2">
            placeholder
          </div>
          <div>The {tab.label.toLowerCase()} workflow lives here.</div>
        </div>
      </div>
    </div>
  )
}
