export default function FigureContext({ data, controls }) {
  if (!data) {
    return (
      <div className="text-text-muted text-sm leading-relaxed">
        Submit an image to see its Gemini-generated description here.
      </div>
    )
  }

  const description = data.description || ''
  const savedPaperTitle = data.savedPaperTitle

  const {
    saveToIndex = false,
    onChangeSaveToIndex,
    hasPaper = false,
    paperTitle = '',
  } = controls || {}

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2 font-mono">
          Description
        </div>
        <div className="card p-3 text-xs leading-relaxed whitespace-pre-wrap break-words max-h-[260px] overflow-y-auto">
          {description || '—'}
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2 font-mono">
          Persistence
        </div>
        <label className="card p-3 flex items-start justify-between gap-3 cursor-pointer">
          <div>
            <div className="text-sm">Save to paper index</div>
            <div className="text-[11px] text-text-muted leading-snug mt-0.5">
              {hasPaper
                ? `On submit, add this description to "${paperTitle}".`
                : 'Pick a linked paper in the form to enable.'}
            </div>
          </div>
          <Switch
            checked={saveToIndex}
            disabled={!hasPaper}
            onChange={(v) => onChangeSaveToIndex?.(v)}
          />
        </label>
      </div>

      {savedPaperTitle && (
        <div className="card border-accent/40 bg-accent/5 p-3 text-xs leading-relaxed">
          Figure description added to <strong>{savedPaperTitle}</strong> —
          future queries on this paper can now reference this figure.
        </div>
      )}
    </div>
  )
}

function Switch({ checked, disabled, onChange }) {
  return (
    <span className={`relative inline-block ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <span
        onClick={() => !disabled && onChange(!checked)}
        className="block w-9 h-5 bg-border peer-checked:bg-accent rounded-full transition-colors"
      >
        <span
          className={`absolute left-0.5 top-0.5 w-4 h-4 bg-text-primary rounded-full transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </span>
    </span>
  )
}
