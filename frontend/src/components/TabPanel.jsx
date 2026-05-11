import { TABS } from '../tabs'
import AskPaperTab from './AskPaperTab'
import SmartRouterTab from './SmartRouterTab'

const PLACEHOLDER_COPY = {
  deepdive:
    'Comparative questions across multiple papers. The engine decomposes your question into per-paper sub-questions.',
  agent:
    "A ReAct agent that chains retrieval and calculator tools. Reasoning steps appear in the right panel.",
  network:
    "Multi-document agent that pulls from every paper in your library and shows each paper's contribution.",
  figure:
    'Drop in a figure (architecture diagram, plot, table) and ask about it. Gemini multi-modal handles the read.',
}

export default function TabPanel({
  activeTab,
  papers,
  chats,
  updateChat,
  setRightDataFor,
  addJournalEntry,
  arxivOn,
  onArxivSearch,
}) {
  const messages = chats[activeTab] || []
  const onMessagesChange = (fn) => updateChat(activeTab, fn)

  if (activeTab === 'ask') {
    return (
      <AskPaperTab
        papers={papers}
        messages={messages}
        onMessagesChange={onMessagesChange}
        onRightPanelData={(d) => setRightDataFor('ask', d)}
        onJournalEntry={addJournalEntry}
        arxivOn={arxivOn}
        onArxivSearch={onArxivSearch}
      />
    )
  }

  if (activeTab === 'router') {
    return (
      <SmartRouterTab
        papers={papers}
        messages={messages}
        onMessagesChange={onMessagesChange}
        onRightPanelData={(d) => setRightDataFor('router', d)}
        onJournalEntry={addJournalEntry}
      />
    )
  }

  // Other tabs: placeholder until wired in later passes.
  const tab = TABS.find((t) => t.id === activeTab)
  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xl font-semibold mb-2">{tab?.label}</h2>
        <p className="text-text-muted text-sm leading-relaxed mb-8">
          {PLACEHOLDER_COPY[activeTab]}
        </p>
        <div className="card border-dashed p-12 text-center text-text-muted text-sm">
          <div className="font-mono text-xs uppercase tracking-wider mb-2">
            placeholder
          </div>
          <div>The {tab?.label.toLowerCase()} workflow lives here.</div>
        </div>
      </div>
    </div>
  )
}
