import { useEffect, useState } from 'react'
import { api } from './api'
import { DEFAULT_TAB } from './tabs'
import Sidebar from './components/Sidebar'
import Tabs from './components/Tabs'
import TabPanel from './components/TabPanel'
import RightPanel from './components/RightPanel'

export default function App() {
  const [papers, setPapers] = useState([])
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  // Initial library load. Failure here is non-fatal — the sidebar will
  // still let the user upload, and the next mutation refreshes the list.
  useEffect(() => {
    api
      .listPapers()
      .then(setPapers)
      .catch((err) => console.error('listPapers failed:', err))
  }, [])

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
    // arXiv import returns {paper_id, title}; fill in a placeholder filename
    // so the sidebar card renders consistently with uploaded papers.
    handleUploaded({ filename: `${record.paper_id}.pdf`, ...record })
  }

  return (
    <div className="flex h-full w-full bg-bg text-text-primary">
      <Sidebar
        papers={papers}
        onUploaded={handleUploaded}
        onDeleted={handleDeleted}
        onImported={handleImported}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <Tabs activeTab={activeTab} onChange={setActiveTab} />
        <TabPanel activeTab={activeTab} />
      </main>

      <RightPanel
        activeTab={activeTab}
        collapsed={rightCollapsed}
        onToggle={() => setRightCollapsed((v) => !v)}
      />
    </div>
  )
}
