import { useEffect, useMemo, useRef, useState } from 'react'
import { colorForPaper } from '../colors'

const STAGGER_MS = 450
const STEP_LEAD_IN_MS = 150

export default function ReasoningTrace({ data, papers, onPulsePaper }) {
  if (!data) {
    return (
      <div className="text-text-muted text-sm leading-relaxed">
        Run a query to watch the agent's reasoning steps here.
      </div>
    )
  }

  const trace = data.reasoning_trace || []
  return (
    <Trace
      trace={trace}
      finalAnswer={data.answer}
      papers={papers}
      onPulsePaper={onPulsePaper}
      animationKey={data.animationKey}
    />
  )
}

function Trace({ trace, finalAnswer, papers, onPulsePaper, animationKey }) {
  const [visible, setVisible] = useState(trace.length)

  // Keep the latest pulse callback in a ref so the stagger effect only
  // re-runs when a new trace arrives — not on every parent re-render.
  const pulseRef = useRef(onPulsePaper)
  useEffect(() => {
    pulseRef.current = onPulsePaper
  })

  useEffect(() => {
    if (!animationKey || !trace.length) {
      setVisible(trace.length)
      return
    }
    setVisible(0)
    const timers = trace.map((step, i) =>
      setTimeout(() => {
        setVisible(i + 1)
        if (step.paper_id) pulseRef.current?.(step.paper_id)
      }, STEP_LEAD_IN_MS + i * STAGGER_MS)
    )
    return () => timers.forEach(clearTimeout)
  }, [animationKey, trace])

  const toolSummary = useMemo(() => summariseTools(trace, papers), [trace, papers])

  if (trace.length === 0) {
    return (
      <div className="text-text-muted text-sm">
        The agent answered without calling any tools.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {trace.slice(0, visible).map((step, i) => (
          <StepCard
            key={`${animationKey}-${i}`}
            index={i + 1}
            step={step}
            papers={papers}
          />
        ))}
        {visible < trace.length && (
          <div className="flex items-center gap-2 text-text-muted text-xs">
            <ThinkingDots />
            <span>Agent thinking…</span>
          </div>
        )}
      </div>

      {visible >= trace.length && (
        <div className="pt-3 border-t border-border space-y-2 step-fade-in">
          <div className="text-[10px] uppercase tracking-wider text-text-muted font-mono">
            Summary
          </div>
          <div className="text-xs text-text-primary">
            <span className="text-text-muted">Steps:</span> {trace.length}
          </div>
          <div className="text-xs text-text-primary">
            <span className="text-text-muted">Tools used:</span>{' '}
            {toolSummary.length === 0 ? (
              <span className="text-text-muted">—</span>
            ) : (
              <span className="font-mono">
                {toolSummary.map((t) => `${t.name}×${t.count}`).join(', ')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StepCard({ index, step, papers }) {
  const paper = papers.find((p) => p.paper_id === step.paper_id)
  return (
    <article className="card p-3 space-y-3 step-fade-in">
      <header className="flex items-center justify-between text-[10px] uppercase tracking-wider text-text-muted font-mono">
        <span>Step {String(index).padStart(2, '0')}</span>
        {step.tool_name && (
          <span className="flex items-center gap-1.5">
            {step.paper_id && (
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: colorForPaper(step.paper_id) }}
                aria-hidden="true"
              />
            )}
            <span className="text-text-muted normal-case truncate max-w-[160px]">
              {paper?.title || step.tool_name}
            </span>
          </span>
        )}
      </header>
      {step.thought && (
        <Section label="Thought" tone="thought" body={step.thought} />
      )}
      {step.action && (
        <Section label="Action" tone="action" body={step.action} mono />
      )}
      {step.observation && (
        <Section
          label="Observation"
          tone="observation"
          body={step.observation}
        />
      )}
    </article>
  )
}

const TONES = {
  thought: {
    border: 'border-l-accent',
    label: 'text-accent',
  },
  action: {
    border: 'border-l-blue-400',
    label: 'text-blue-400',
  },
  observation: {
    border: 'border-l-green-400',
    label: 'text-green-400',
  },
}

function Section({ label, tone, body, mono }) {
  const t = TONES[tone] || TONES.thought
  return (
    <div className={`border-l-2 pl-3 ${t.border}`}>
      <div
        className={`text-[10px] uppercase tracking-wider mb-1 font-mono ${t.label}`}
      >
        {label}
      </div>
      <div
        className={`text-xs leading-relaxed text-text-primary whitespace-pre-wrap break-words ${
          mono ? 'font-mono' : ''
        }`}
      >
        {body}
      </div>
    </div>
  )
}

function summariseTools(trace, papers) {
  const counts = new Map()
  for (const step of trace) {
    const key = step.tool_name
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return [...counts.entries()].map(([toolName, count]) => {
    const paper = papers.find((p) => p.paper_id === toolName)
    return { name: paper?.title || toolName, count }
  })
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
