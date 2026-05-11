import { useCallback } from 'react'
import AskPaperTab from './AskPaperTab'
import SmartRouterTab from './SmartRouterTab'
import DeepDiveTab from './DeepDiveTab'
import AgentTab from './AgentTab'
import PaperNetworkTab from './PaperNetworkTab'
import FigureReaderTab from './FigureReaderTab'

export default function TabPanel({
  activeTab,
  papers,
  chats,
  updateChat,
  singleshot,
  updateSingleshot,
  setRightDataFor,
  addJournalEntry,
  arxivOn,
  onArxivSearch,
}) {
  const messages = chats[activeTab] || []
  const onMessagesChange = (fn) => updateChat(activeTab, fn)

  const patchDeepDive = useCallback(
    (patch) => updateSingleshot('deepdive', patch),
    [updateSingleshot]
  )
  const patchAgent = useCallback(
    (patch) => updateSingleshot('agent', patch),
    [updateSingleshot]
  )
  const patchNetwork = useCallback(
    (patch) => updateSingleshot('network', patch),
    [updateSingleshot]
  )
  const patchFigure = useCallback(
    (patch) => updateSingleshot('figure', patch),
    [updateSingleshot]
  )

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
        paperId={
          singleshot.ask?.paperId ?? papers[0]?.paper_id ?? ''
        }
        onPaperIdChange={(id) => updateSingleshot('ask', { paperId: id })}
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
        arxivOn={arxivOn}
        onArxivSearch={onArxivSearch}
      />
    )
  }

  if (activeTab === 'deepdive') {
    return (
      <DeepDiveTab
        papers={papers}
        state={singleshot.deepdive || {}}
        patchState={patchDeepDive}
        setRightPanelData={(d) => setRightDataFor('deepdive', d)}
        addJournalEntry={addJournalEntry}
      />
    )
  }

  if (activeTab === 'agent') {
    return (
      <AgentTab
        papers={papers}
        state={singleshot.agent || {}}
        patchState={patchAgent}
        setRightPanelData={(d) => setRightDataFor('agent', d)}
        addJournalEntry={addJournalEntry}
      />
    )
  }

  if (activeTab === 'network') {
    return (
      <PaperNetworkTab
        papers={papers}
        state={singleshot.network || {}}
        patchState={patchNetwork}
        setRightPanelData={(d) => setRightDataFor('network', d)}
        addJournalEntry={addJournalEntry}
      />
    )
  }

  if (activeTab === 'figure') {
    return (
      <FigureReaderTab
        papers={papers}
        state={singleshot.figure || {}}
        patchState={patchFigure}
        setRightPanelData={(d) => setRightDataFor('figure', d)}
        addJournalEntry={addJournalEntry}
      />
    )
  }

  return null
}
