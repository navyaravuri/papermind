import { useEffect, useRef, useState } from 'react'

// Reusable chat surface for any tab that follows the Q→A pattern.
// The parent owns the messages array and submit/retry handlers, so each
// tab can wire its own API call and right-panel data shape.
export default function ChatPanel({
  messages,
  onSubmit,
  onRetry,
  disabled,
  disabledHint,
  placeholder,
  emptyHint,
}) {
  const [input, setInput] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  function handleSubmit(e) {
    e?.preventDefault()
    const q = input.trim()
    if (!q || disabled) return
    setInput('')
    onSubmit(q)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-5">
        {messages.length === 0 ? (
          <div className="text-text-muted text-sm text-center py-16">
            {emptyHint || 'Ask a question to start.'}
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} message={m} onRetry={onRetry} />
          ))
        )}
      </div>
      <form onSubmit={handleSubmit} className="border-t border-border pt-3 flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={disabled ? disabledHint || 'Unavailable' : placeholder || 'Ask…'}
          disabled={disabled}
          className="flex-1 bg-surface border border-border rounded-md px-3 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="btn-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </div>
  )
}

function MessageBubble({ message, onRetry }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-surface border border-border rounded-md px-3 py-2 text-sm whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    )
  }

  if (message.status === 'pending') {
    return (
      <div className="flex items-center gap-2 text-text-muted text-sm">
        <ThinkingDots />
        <span>Thinking…</span>
      </div>
    )
  }

  if (message.status === 'error') {
    return (
      <div className="max-w-[80%] bg-red-500/5 border border-red-500/40 rounded-md p-3 text-sm">
        <div className="text-red-300 mb-2 font-mono text-xs break-words">
          {message.error || 'Request failed'}
        </div>
        <button
          onClick={() => onRetry?.(message)}
          className="text-xs text-accent hover:text-accent-hover transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start">
      <div className="max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap">
        {message.content}
      </div>
      {message.confidence && (
        <div className="text-[11px] text-text-muted mt-2 font-mono">
          {message.confidence}
        </div>
      )}
    </div>
  )
}

function ThinkingDots() {
  return (
    <span className="inline-flex gap-1" aria-hidden="true">
      <span
        className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"
        style={{ animationDelay: '0ms' }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"
        style={{ animationDelay: '150ms' }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"
        style={{ animationDelay: '300ms' }}
      />
    </span>
  )
}
