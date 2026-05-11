import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { TABS, DEFAULT_TAB } from './tabs'
import Sidebar from './components/Sidebar'
import Tabs from './components/Tabs'
import TabPanel from './components/TabPanel'
import RightPanel from './components/RightPanel'
import JournalDrawer from './components/JournalDrawer'
import BootScreen from './components/BootScreen'

// Right panel becomes a drawer overlay below this width.
const WIDE_BREAKPOINT = 1280

export default function App() {
  const [papers, setPapers] = useState([])
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB)

  // Start collapsed if we're booting on a narrow viewport — avoids a
  // first-paint where the right panel briefly takes 320px on a 1024px screen.
  const initialIsWide =
    typeof window === 'undefined' ? true : window.innerWidth >= WIDE_BREAKPOINT
  const [rightCollapsed, setRightCollapsed] = useState(!initialIsWide)
  const [isWide, setIsWide] = useState(initialIsWide)

  useEffect(() => {
    function onResize() {
      const wide = window.innerWidth >= WIDE_BREAKPOINT
      setIsWide((prev) => {
        if (prev !== wide) {
          // Auto-collapse whenever we cross into narrow territory.
          if (!wide) setRightCollapsed(true)
        }
        return wide
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Per-tab chat history. Keying by tab id keeps state when the user
  // switches away and back, without re-mounting the tab component.
  const [chats, setChats] = useState({})
  const [panelData, setPanelData] = useState({})

  // One-shot tabs (Deep Dive, Agent) don't use a chat. We hold their
  // last-submitted state up here so switching tabs preserves it.
  const [singleshot, setSingleshot] = useState({})

  // Paper-pulse signals: { paperId: monotonically-increasing version }.
  // The sidebar's PaperCard watches its own counter and restarts a CSS
  // animation when it changes — supports rapid repeat pulses without
  // missing any like a single-flag pattern would.
  const [pulseSignals, setPulseSignals] = useState({})

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

  // App-level upload so EmptyLibraryState (which lives in tabs) doesn't have
  // to reach into the sidebar. Sidebar's own upload button uses this too.
  const uploadFile = useCallback(async (file) => {
    const record = await api.uploadPaper(file)
    handleUploaded(record)
    return record
  }, [])

  const openArxivPanel = useCallback(() => {
    setArxivOn(true)
  }, [])

  const updateSingleshot = useCallback((tab, patch) => {
    setSingleshot((prev) => ({
      ...prev,
      [tab]: { ...(prev[tab] || {}), ...patch },
    }))
  }, [])

  const pulsePaper = useCallback((paperId) => {
    if (!paperId) return
    setPulseSignals((prev) => ({
      ...prev,
      [paperId]: (prev[paperId] || 0) + 1,
    }))
  }, [])

  // Controls surfaced to the Figure Context right-panel so the user can
  // toggle "Save to paper index" without us bouncing state through panelData.
  const figureState = singleshot.figure || {}
  const linkedPaper = papers.find(
    (p) => p.paper_id === figureState.paperId
  )
  const figureControls = useMemo(
    () => ({
      saveToIndex: !!figureState.saveToIndex,
      onChangeSaveToIndex: (v) => updateSingleshot('figure', { saveToIndex: v }),
      hasPaper: !!figureState.paperId,
      paperTitle: linkedPaper?.title || figureState.paperId || '',
    }),
    [
      figureState.saveToIndex,
      figureState.paperId,
      linkedPaper?.title,
      updateSingleshot,
    ]
  )

  return (
    <>
      <BootScreen />
    <div className="flex h-full w-full bg-bg text-text-primary">
      <Sidebar
        papers={papers}
        onUploadFile={uploadFile}
        onDeleted={handleDeleted}
        onImported={handleImported}
        arxivOn={arxivOn}
        onArxivOnChange={setArxivOn}
        arxivQuery={arxivQuery}
        onArxivQueryChange={setArxivQuery}
        pulseSignals={pulseSignals}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <Tabs
          activeTab={activeTab}
          onChange={setActiveTab}
          onOpenJournal={() => setJournalOpen(true)}
          journalCount={journal.length}
          showContextToggle={!isWide}
          rightCollapsed={rightCollapsed}
          onToggleContext={() => setRightCollapsed((v) => !v)}
        />
        {/* key={activeTab} replays the fade-in animation on every tab change.
            Per-tab UI state lives in chats/singleshot/panelData up here, so
            the remount doesn't lose anything important. */}
        <div key={activeTab} className="tab-fade-in flex-1 flex flex-col min-h-0">
          <TabPanel
            activeTab={activeTab}
            papers={papers}
            chats={chats}
            updateChat={updateChat}
            singleshot={singleshot}
            updateSingleshot={updateSingleshot}
            setRightDataFor={setRightDataFor}
            addJournalEntry={appendJournalEntry}
            arxivOn={arxivOn}
            onArxivSearch={triggerArxivSearch}
            onUploadFile={uploadFile}
            onOpenArxiv={openArxivPanel}
          />
        </div>
      </main>

      <RightPanel
        activeTab={activeTab}
        panelData={panelData}
        papers={papers}
        collapsed={rightCollapsed}
        onToggle={() => setRightCollapsed((v) => !v)}
        onPulsePaper={pulsePaper}
        arxivOn={arxivOn}
        onArxivSearch={triggerArxivSearch}
        figureControls={figureControls}
        isWide={isWide}
      />

      <JournalDrawer
        open={journalOpen}
        onClose={() => setJournalOpen(false)}
        entries={journal}
        tabLabels={tabLabels}
      />
    </div>
    </>
  )
}
