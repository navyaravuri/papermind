import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { TABS, DEFAULT_TAB } from './tabs'
import Sidebar from './components/Sidebar'
import Tabs from './components/Tabs'
import TabPanel from './components/TabPanel'
import RightPanel from './components/RightPanel'
import JournalDrawer from './components/JournalDrawer'

export default function App() {
  const [papers, setPapers] = useState([])
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  // Per-tab chat history. Keying by tab id keeps state when the user
  // switches away and back, without re-mounting the tab component.
  const [chats, setChats] = useState({})
  const [panelData, setPanelData] = useState({})

  const [journal, setJournal] = useState([])
  const [journalOpen, setJournalOpen] = useState(false)

  // Lifted so the Ask-a-Paper nudge banner can flip the sidebar arXiv
  // search on with a pre-filled query.
  const [arxivOn, setArxivOn] = useState(false)
  const [arxivQuery, setArxivQuery] = useState('')

  useEffect(() => {
    api
      .listPapers()
      .then(setPapers)
      .catch((err) => console.error('listPapers failed:', err))
  }, [])

  const tabLabels = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.id, t.label])),
    []
  )

  function handleUploaded(record) {
    setPapers((prev) =>
      prev.some((p) => p.paper_id === record.paper_id)
        ? prev.map((p) => (p.paper_id === record.paper_id ? record : p))
        : [...prev, record]
    )
  }

  function handleDeleted(paperId) {
    setPapers((prev) => prev.filter((p) => p.paper_id !== paperId))
  }

  function handleImported(record) {
    handleUploaded({ filename: `${record.paper_id}.pdf`, ...record })
  }

  // Pass a tab-scoped updater into tab components so they don't accidentally
  // clobber another tab's chat.
  const updateChat = useCallback((tab, fn) => {
    setChats((prev) => {
      const next = typeof fn === 'function' ? fn(prev[tab] || []) : fn
      return { ...prev, [tab]: next }
    })
  }, [])

  const setRightDataFor = useCallback((tab, data) => {
    setPanelData((prev) => ({ ...prev, [tab]: data }))
  }, [])

  const appendJournalEntry = useCallback((entry) => {
    setJournal((prev) => [
      ...prev,
      {
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random()}`,
        ts: Date.now(),
        ...entry,
      },
    ])
  }, [])

  const triggerArxivSearch = useCallback((query) => {
    if (query == null) return
    setArxivOn(true)
    setArxivQuery(query)
  }, [])

  return (
    <div className="flex h-full w-full bg-bg text-text-primary">
      <Sidebar
        papers={papers}
        onUploaded={handleUploaded}
        onDeleted={handleDeleted}
        onImported={handleImported}
        arxivOn={arxivOn}
        onArxivOnChange={setArxivOn}
        arxivQuery={arxivQuery}
        onArxivQueryChange={setArxivQuery}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <Tabs
          activeTab={activeTab}
          onChange={setActiveTab}
          onOpenJournal={() => setJournalOpen(true)}
          journalCount={journal.length}
        />
        <TabPanel
          activeTab={activeTab}
          papers={papers}
          chats={chats}
          updateChat={updateChat}
          setRightDataFor={setRightDataFor}
          addJournalEntry={appendJournalEntry}
          arxivOn={arxivOn}
          onArxivSearch={triggerArxivSearch}
        />
      </main>

      <RightPanel
        activeTab={activeTab}
        panelData={panelData}
        papers={papers}
        collapsed={rightCollapsed}
        onToggle={() => setRightCollapsed((v) => !v)}
      />

      <JournalDrawer
        open={journalOpen}
        onClose={() => setJournalOpen(false)}
        entries={journal}
        tabLabels={tabLabels}
      />
    </div>
  )
}
