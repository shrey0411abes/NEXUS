import { useState } from 'react'

const TRANSITIONS = [
  {
    state: 'ACKNOWLEDGED',
    title: 'Acknowledge',
    desc: 'Mark as seen and being worked. Stays active in the queue.',
  },
  {
    state: 'RESOLVED',
    title: 'Resolve',
    desc: 'Underlying issue has been addressed. Suppressed for 24h, then re-checked.',
  },
  {
    state: 'DISMISSED',
    title: 'Dismiss',
    desc: 'Intentional waiver. Suppressed for 7 days, then re-checked.',
  },
]

export default function ActionModal({ risk, onClose, onSubmit }) {
  const [transition, setTransition] = useState(null)
  const [note, setNote] = useState('')

  const handleSubmit = () => {
    if (!transition) return
    // Real implementation: await recordRiskAction(payload) THEN, only for
    // RESOLVED, optionally await updateInventory(...) — never the reverse.
    onSubmit({ state: transition, note: note.trim() })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{risk.risk_category.replaceAll('_', ' ')}</h3>
        <p className="modal-sub">
          {risk.sku} · rank {risk.priority_rank} · currently {risk.current_state}
        </p>

        <div className="transition-options">
          {TRANSITIONS.map((t) => (
            <button
              key={t.state}
              type="button"
              className={`transition-option${transition === t.state ? ' selected' : ''}`}
              onClick={() => setTransition(t.state)}
            >
              <strong>{t.title}</strong>
              <span>{t.desc}</span>
            </button>
          ))}
        </div>

        <textarea
          placeholder="Optional note — e.g. PO number, rationale…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="modal-actions">
          <button className="btn-ghost btn-small" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary btn-small"
            disabled={!transition}
            onClick={handleSubmit}
          >
            Record action
          </button>
        </div>
      </div>
    </div>
  )
}
