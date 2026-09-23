import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X,
  AlertTriangle,
  ShieldCheck,
  TrendingDown,
  Layers,
  Sparkles,
  ArrowRight,
  RotateCw,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react'
import StatePill from './StatePill.jsx'
import { recordRiskAction } from '../api.js'
import { useI18n } from '../i18n/index.jsx'


export default function RiskIntelligenceDrawer({ risk, onClose, onActionSuccess }) {
  const [actionState, setActionState] = useState(risk?.current_state || 'OPEN')
  const [actionNote, setActionNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const navigate = useNavigate()
  const { t, formatCurrency, formatNumber } = useI18n()

  if (!risk) return null

  const handleAction = async (targetState) => {
    setIsSubmitting(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      await recordRiskAction({
        risk_fingerprint: risk.risk_fingerprint,
        product_id: risk.product_id ?? null,
        risk_category: risk.risk_category,
        state: targetState,
        action_note: actionNote.trim() || `Marked as ${targetState} via Intelligence Drawer`,
      })
      setActionState(targetState)
      setSuccessMsg(t('riskDrawer.actionSuccess'))
      if (onActionSuccess) {
        onActionSuccess({ ...risk, current_state: targetState })
      }
    } catch (err) {
      setErrorMsg(err.message || `Failed to record ${targetState} action.`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInvestigate = () => {
    const question = `Analyze operational risk for ${risk.product_name || risk.sku} (${risk.risk_category?.replaceAll('_', ' ')})`
    navigate(`/investigations?q=${encodeURIComponent(question)}`)
    onClose()
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="intelligence-drawer" aria-label={t('riskDrawer.triageTitle')}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className={`severity ${risk.severity ? risk.severity.toLowerCase() : 'medium'}`}>
                {risk.severity || 'RISK'}
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--cyan)' }}>
                {t('riskDrawer.rankBadge', { rank: String(risk.priority_rank ?? 1).padStart(2, '0') })}
              </span>
              {risk.priority_score != null && (
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  SCORE: {Number(risk.priority_score).toFixed(1)}
                </span>
              )}
              <StatePill state={actionState} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', marginTop: 4 }}>
              {risk.product_name || 'Business Operational Scope'}
            </h2>
            {risk.sku && (
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {t('global.sku')}: <strong style={{ color: 'var(--text-secondary)' }}>{risk.sku}</strong> · {t('global.category')}: {risk.risk_category?.replaceAll('_', ' ')}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ color: 'var(--text-muted)', padding: 6, borderRadius: 'var(--radius-xs)', display: 'inline-flex' }}
            title={`${t('global.close')} (Esc)`}
            aria-label={t('global.close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="drawer-content">

          {/* Alert messages */}
          {errorMsg && (
            <div className="state-box error" style={{ padding: '10px 14px', fontSize: 12 }}>
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="state-box" style={{ padding: '10px 14px', fontSize: 12, borderColor: 'rgba(0,230,118,0.4)', background: 'var(--resolved-bg)', color: 'var(--resolved-light)' }}>
              {successMsg}
            </div>
          )}

          {/* SECTION 1: WHY THIS IS SURFACING */}
          <div>
            <div className="drawer-section-title">
              <AlertTriangle size={13} color="var(--risk)" />
              <span>{t('riskDrawer.whyThisRiskMatters')}</span>
            </div>
            <div style={{ background: 'rgba(255, 77, 94, 0.04)', border: '1px solid rgba(255, 77, 94, 0.2)', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                {risk.impact_summary || 'Deterministic threshold violation identified by cross-domain analytics engine.'}
              </p>
              {risk.recommended_action && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255, 77, 94, 0.15)', fontSize: 12, color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--risk-light)', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 11 }}>
                    {t('riskDrawer.recommendedNextStep')}:
                  </strong>{' '}
                  {risk.recommended_action}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: VERIFIED FACTS */}
          <div>
            <div className="drawer-section-title">
              <ShieldCheck size={13} color="var(--resolved)" />
              <span>{t('riskDrawer.factsSectionTitle')}</span>
            </div>
            <div className="drawer-verified-box">
              <div className="drawer-facts-grid">
                <div className="drawer-fact-item">
                  <span className="drawer-fact-label">{t('global.category')}</span>
                  <span className="drawer-fact-val" style={{ fontSize: 13, textTransform: 'capitalize' }}>
                    {risk.risk_category?.replaceAll('_', ' ') || '—'}
                  </span>
                </div>
                <div className="drawer-fact-item">
                  <span className="drawer-fact-label">{t('global.status')}</span>
                  <span className="drawer-fact-val" style={{ fontSize: 13 }}>
                    {actionState}
                  </span>
                </div>
                <div className="drawer-fact-item">
                  <span className="drawer-fact-label">{t('riskQueue.rankHeader')}</span>
                  <span className="drawer-fact-val mono">
                    #{String(risk.priority_rank ?? 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="drawer-fact-item">
                  <span className="drawer-fact-label">{t('global.confidence')}</span>
                  <span className="drawer-fact-val mono">
                    {risk.priority_score != null ? Number(risk.priority_score).toFixed(2) : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: AI EXPLAINS */}
          <div>
            <div className="drawer-section-title">
              <Sparkles size={13} color="var(--purple)" />
              <span>{t('riskDrawer.aiReasoningSectionTitle')}</span>
            </div>
            <div className="drawer-ai-explains">
              <div className="drawer-ai-tag">
                <Sparkles size={11} />
                <span>{t('investigations.deterministicGrounding')}</span>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                Based on authoritative sales velocity and inventory thresholds, this SKU requires operational adjustment to mitigate financial exposure. The underlying metrics are evaluated deterministically; AI provides contextual framing rather than synthetic estimates.
              </p>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--purple)' }}>
                  {t('riskDrawer.disclaimer')}
                </span>
                <button
                  type="button"
                  onClick={handleInvestigate}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--brand-light)',
                    background: 'rgba(79, 117, 255, 0.1)',
                    border: '1px solid rgba(79, 117, 255, 0.3)',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-xs)',
                  }}
                >
                  <span>{t('investigations.investigateBtn')}</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 4: ACTION NOTE */}
          <div>
            <div className="drawer-section-title">
              <Clock size={13} color="var(--text-muted)" />
              <span>{t('riskDrawer.lifecycleSectionTitle', { state: actionState })}</span>
            </div>
            <textarea
              style={{
                width: '100%',
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontFamily: 'inherit',
                minHeight: 70,
                resize: 'vertical',
                outline: 'none',
              }}
              placeholder={t('riskDrawer.notePlaceholder')}
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
            />
          </div>

        </div>

        {/* Drawer Footer Actions */}
        <div className="drawer-footer">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {actionState !== 'ACKNOWLEDGED' && (
                <button
                  type="button"
                  className="btn-command-action secondary"
                  onClick={() => handleAction('ACKNOWLEDGED')}
                  disabled={isSubmitting}
                >
                  {t('global.acknowledged')}
                </button>
              )}
              {actionState !== 'RESOLVED' && (
                <button
                  type="button"
                  className="btn-command-action primary"
                  style={{ background: 'var(--resolved)', color: '#000', borderColor: 'var(--resolved)' }}
                  onClick={() => handleAction('RESOLVED')}
                  disabled={isSubmitting}
                >
                  <CheckCircle2 size={14} />
                  <span>{t('global.resolved')}</span>
                </button>
              )}
              {actionState !== 'DISMISSED' && (
                <button
                  type="button"
                  className="btn-command-action secondary"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => handleAction('DISMISSED')}
                  disabled={isSubmitting}
                >
                  {t('global.dismissed')}
                </button>
              )}
            </div>

            <button
              type="button"
              className="btn-command-action primary"
              onClick={handleInvestigate}
            >
              <span>{t('investigations.investigateBtn')}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
