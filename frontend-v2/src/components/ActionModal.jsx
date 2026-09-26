import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, CheckCircle, ShieldAlert, X } from 'lucide-react'

const TRANSITIONS = [
  {
    state: 'ACKNOWLEDGED',
    title: 'Acknowledge',
    desc: 'Mark as seen and being worked. Stays active in the operational queue.',
    color: '#f59e0b',
  },
  {
    state: 'RESOLVED',
    title: 'Resolve',
    desc: 'Underlying stock or flow issue addressed. Suppressed for 24h, then re-evaluated.',
    color: '#2E9E83',
  },
  {
    state: 'DISMISSED',
    title: 'Dismiss',
    desc: 'Intentional operational waiver. Suppressed for 7 days, then re-evaluated.',
    color: '#64748b',
  },
]

export default function ActionModal({ risk, onClose, onSubmit }) {
  const [transition, setTransition] = useState(null)
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [shake, setShake] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleClose = useCallback(() => {
    if (isClosing || isSubmitting) return
    setIsClosing(true)
    setTimeout(() => {
      onClose()
    }, 150) // Match actionModalScaleOut duration (150ms)
  }, [isClosing, isSubmitting, onClose])

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleClose])

  const triggerShake = (msg = '') => {
    setShake(true)
    if (msg) setErrorMessage(msg)
    setTimeout(() => setShake(false), 450)
  }

  const handleSubmit = async () => {
    if (!transition) {
      triggerShake('Please select an operational transition state.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      // Real implementation: record action in backend
      await onSubmit({
        state: transition,
        note: note.trim(),
      })
      // Success: animate out smoothly
      setIsClosing(true)
      setTimeout(() => {
        onClose()
      }, 150)
    } catch (err) {
      setIsSubmitting(false)
      triggerShake(err?.message || 'Failed to record operational risk action.')
    }
  }

  return (
    <div
      className={`action-modal-overlay ${isClosing ? 'closing' : ''}`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-modal-title"
    >
      <div
        className={`action-modal-box ${isClosing ? 'closing' : ''} ${shake ? 'shake' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <ShieldAlert size={18} color="#f43f5e" />
              <h3
                id="action-modal-title"
                style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.01em' }}
              >
                {(risk.risk_category || 'OPERATIONAL RISK').replaceAll('_', ' ')}
              </h3>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', margin: 0 }} className="mono">
              SKU: <span style={{ color: '#fff' }}>{risk.sku || 'N/A'}</span> · Rank #{risk.priority_rank ?? 1} · Currently{' '}
              <span style={{ color: '#38bdf8' }}>{risk.current_state || 'OPEN'}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Inline Error Message on failure */}
        {errorMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 6,
              background: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#fb7185',
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Transition Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
          {TRANSITIONS.map((t) => {
            const isSelected = transition === t.state
            return (
              <button
                key={t.state}
                type="button"
                className={`transition-option ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  setTransition(t.state)
                  setErrorMessage('')
                }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 6,
                  background: isSelected ? 'rgba(124, 58, 237, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                  border: isSelected ? '1px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.08)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 0 16px rgba(168, 85, 247, 0.2)' : 'none',
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    border: isSelected ? `5px solid ${t.color}` : '2px solid #475569',
                    marginTop: 2,
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? '#fff' : '#e2e8f0', marginBottom: 2 }}>
                    {t.title}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.4 }}>
                    {t.desc}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Note Textarea */}
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="action-modal-note"
            style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            Audit Transition Note (Optional)
          </label>
          <textarea
            id="action-modal-note"
            placeholder="e.g. PO #10842 dispatched, physical count reconciled, waiver rationale…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isSubmitting}
            style={{
              width: '100%',
              minHeight: 70,
              padding: '10px 12px',
              borderRadius: 6,
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#fff',
              fontSize: 12.5,
              lineHeight: 1.4,
              resize: 'vertical',
              boxSizing: 'border-box',
              outline: 'none',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#a855f7')}
            onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)')}
          />
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            className="btn-ghost btn-small"
            onClick={handleClose}
            disabled={isSubmitting}
            style={{
              padding: '8px 16px',
              borderRadius: 4,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'transparent',
              color: '#94a3b8',
              fontSize: 12.5,
              fontWeight: 500,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!transition || isSubmitting}
            style={{
              padding: '8px 18px',
              borderRadius: 4,
              border: 'none',
              background: !transition || isSubmitting ? 'rgba(124, 58, 237, 0.4)' : '#7c3aed',
              color: '#fff',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: !transition || isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'background 0.15s ease',
            }}
          >
            {isSubmitting ? (
              <span>Recording…</span>
            ) : (
              <>
                <CheckCircle size={14} />
                <span>Record Action</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
