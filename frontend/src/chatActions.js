// Shared chat-message lifecycle for the query tabs.
//
// Both Ask-a-Paper and Smart Router follow the same pattern:
//   1. Append user message + pending assistant placeholder.
//   2. Await the API call.
//   3. Replace the placeholder with an `ok` or `error` message.
//   4. On success, also update the right-panel and append a journal entry.
//
// Retry just re-runs step 2–4 against the same assistant message id, so the
// chat history doesn't grow on every retry click.

function newId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random()}`
}

function patchMessage(setMessages, id, patch) {
  setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
}

export async function runChatTurn({
  question,
  setMessages,
  apiCall,
  buildAssistantPatch, // (response) => Partial<Message>
  buildPanelData,     // (response) => any
  setPanelData,
  appendJournal,
  tabId,
  retryPayload,
  reuseAssistantId,   // when set, skip appending — just flip the message back to pending
}) {
  let assistantId = reuseAssistantId
  if (assistantId) {
    patchMessage(setMessages, assistantId, { status: 'pending', error: undefined })
  } else {
    const ts = Date.now()
    assistantId = newId()
    setMessages((prev) => [
      ...prev,
      { id: newId(), role: 'user', content: question, ts },
      { id: assistantId, role: 'assistant', status: 'pending', ts: ts + 1, question, retry: retryPayload },
    ])
  }

  try {
    const response = await apiCall()
    patchMessage(setMessages, assistantId, {
      status: 'ok',
      error: undefined,
      ...buildAssistantPatch(response),
    })
    setPanelData?.(buildPanelData ? buildPanelData(response) : null)
    appendJournal?.({ tab: tabId, question, answer: response.answer || '' })
  } catch (err) {
    patchMessage(setMessages, assistantId, { status: 'error', error: err.message })
  }
}
