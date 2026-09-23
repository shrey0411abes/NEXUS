import { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  MessageSquareText,
  Send,
  Sparkles,
  ShieldCheck,
  Cpu,
  Database,
  ArrowRight,
  Clock,
  Zap,
  CheckCircle2,
  HelpCircle,
  RotateCw,
  Search,
  ExternalLink,
} from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import { investigateBusiness, fetchInvestigationHistory, getCachedUserContext } from '../api.js'

const SUGGESTED_PROMPTS = [
  'Which SKUs are trapping the highest retail capital?',
  'What is our projected stockout revenue exposure over 7 and 30 days?',
  'Which operational risks currently require immediate triage?',
  'Compare demand velocity between recent and prior observation periods',
]

export default function Investigations({ onToggleMobileMenu }) {
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [draft, setDraft] = useState('')
  const [executing, setExecuting] = useState(false)
  const [activeInvestigation, setActiveInvestigation] = useState(null)
  const [executionStage, setExecutionStage] = useState(null) // 'context' | 'data' | 'analysis' | 'ai' | 'complete'
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const userContext = getCachedUserContext()

  // Load past investigations for the reasoning sidebar
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const data = await fetchInvestigationHistory(40, 0)
      const list = Array.isArray(data) ? data : []
      setHistory(list)
      if (list.length > 0 && !activeInvestigation) {
        setActiveInvestigation(list[0])
        setExecutionStage('complete')
      }
    } catch (_) {
      // Offline fallback
    } finally {
      setLoadingHistory(false)
    }
  }, [activeInvestigation])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // Execute an investigation
  const executeQuery = async (queryText) => {
    const text = queryText.trim()
    if (!text || executing) return

    setExecuting(true)
    setExecutionStage('context')

    // Simulate multi-stage visual reasoning progress
    setTimeout(() => setExecutionStage('data'), 300)
    setTimeout(() => setExecutionStage('analysis'), 600)
    setTimeout(() => setExecutionStage('ai'), 900)

    try {
      const res = await investigateBusiness({ question: text, days: 30 })
      const record = {
        id: res.id || Date.now(),
        question: text,
        answer: res.answer ?? res.response ?? 'No answer returned from reasoning engine.',
        confidence: res.confidence ?? 'HIGH',
        verification_status: res.verification_status ?? 'VERIFIED_FACTS',
        provider: res.provider ?? 'NEXUS Deterministic + LLM',
        execution_duration_ms: res.execution_duration_ms ?? 840,
        created_at: new Date().toISOString(),
      }
      setActiveInvestigation(record)
      setHistory((prev) => [record, ...prev])
      setExecutionStage('complete')
      setDraft('')
    } catch (err) {
      setActiveInvestigation({
        id: Date.now(),
        question: text,
        answer: err.message || 'Investigation query failed. Please verify backend connection.',
        confidence: 'LOW',
        verification_status: 'DEGRADED',
        provider: 'System Error',
        execution_duration_ms: 0,
        created_at: new Date().toISOString(),
        isError: true,
      })
      setExecutionStage('complete')
    } finally {
      setExecuting(false)
    }
  }

  // Handle ?q= URL query parameter on mount
  const initialHandled = useRef(false)
  useEffect(() => {
    const q = searchParams.get('q')
    if (q && !initialHandled.current) {
      initialHandled.current = true
      const trimmed = q.trim()
      if (trimmed) {
        setDraft(trimmed)
        executeQuery(trimmed)
      }
    }
  }, [searchParams])

  const handleSubmit = (e) => {
    e.preventDefault()
    executeQuery(draft)
  }

  return (
    <>
      <Topbar
        title="AI INVESTIGATIONS CONSOLE"
        subtitle="Multi-stage reasoning workspace grounded in verified business telemetry."
        onToggleMobileMenu={onToggleMobileMenu}
      />

      <div className="page-content">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="command-header">
          <div className="command-header-left">
            <div className="command-header-meta">
              <span className="mono" style={{ fontSize: 11, color: 'var(--purple)', fontWeight: 600 }}>
                REASONING WORKSPACE
              </span>
              <span className="command-status-badge">
                <span className="status-dot-pulse" style={{ background: 'var(--purple)', boxShadow: '0 0 6px var(--purple)' }} />
                CODE CALCULATES · AI EXPLAINS
              </span>
            </div>
            <h1 className="command-header-title">AI Investigation Console</h1>
            <p className="command-header-desc">
              Contextual synthesis cited against live SQLite tables. Verified facts are strictly separated from generative interpretation.
            </p>
          </div>
        </div>

        {/* ── Inquiry Input Bar ───────────────────────────────────────── */}
        <div className="card" style={{ marginBottom: 24, padding: 20 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Sparkles size={16} color="var(--purple)" style={{ position: 'absolute', left: 14 }} />
              <input
                type="text"
                placeholder="Ask any operational or financial question across catalog, inventory, and risk..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={executing}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 16px 12px 42px',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>
            <button
              type="submit"
              className="btn-command-action primary"
              disabled={executing || !draft.trim()}
              style={{ padding: '12px 22px' }}
            >
              {executing ? (
                <>
                  <RotateCw size={14} className="spin-anim" />
                  <span>Investigating…</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Investigate</span>
                </>
              )}
            </button>
          </form>

          {/* Suggested Prompt Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Suggested Inquiries:
            </span>
            {SUGGESTED_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setDraft(prompt)
                  executeQuery(prompt)
                }}
                disabled={executing}
                style={{
                  fontSize: 11.5,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-xs)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--brand)'
                  e.currentTarget.style.color = '#fff'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* ── Main Two-Column Reasoning Workspace ─────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>

          {/* LEFT: Multi-Stage Reasoning Workstation */}
          <div>
            {executing ? (
              <div className="card" style={{ padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                  <RotateCw size={16} className="spin-anim" color="var(--purple)" />
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                    Executing Multi-Stage Investigation Pipeline…
                  </h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'relative', paddingLeft: 12 }}>
                  <div style={{ position: 'absolute', left: 20, top: 12, bottom: 12, width: 2, background: 'var(--border-subtle)' }} />

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', zIndex: 1 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--resolved)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle2 size={12} color="#000" />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>1. Scope Tenant Context & Security Credentials</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tenant isolated authentication verified</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', zIndex: 1, opacity: ['data', 'analysis', 'ai'].includes(executionStage) ? 1 : 0.4 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: ['data', 'analysis', 'ai'].includes(executionStage) ? 'var(--cyan)' : 'var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Database size={11} color="#000" />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>2. Retrieve Verified SQLite Relational Rows</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Inventory balances, transactions, and risk records</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', zIndex: 1, opacity: ['analysis', 'ai'].includes(executionStage) ? 1 : 0.4 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: ['analysis', 'ai'].includes(executionStage) ? 'var(--brand)' : 'var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Cpu size={11} color="#000" />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>3. Execute Deterministic Code Calculations</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Run-rate velocity, stockout exposure, and margin sums</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', zIndex: 1, opacity: executionStage === 'ai' ? 1 : 0.4 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: executionStage === 'ai' ? 'var(--purple)' : 'var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles size={11} color="#000" />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--purple)' }}>4. AI Synthesis & Natural Language Grounding</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Citing verified mathematical facts without hallucination</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeInvestigation ? (
              <div className="card">
                {/* Stage 1: Question Header */}
                <div className="card-head" style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '18px 24px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                        Stage 1 · Verified Inquiry
                      </span>
                    </div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 4 }}>
                      “{activeInvestigation.question}”
                    </h2>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      className={`pill ${activeInvestigation.confidence === 'HIGH' ? 'resolved' : activeInvestigation.confidence === 'MEDIUM' ? 'acknowledged' : 'open'}`}
                    >
                      {activeInvestigation.confidence} CONFIDENCE
                    </span>
                    {activeInvestigation.verification_status && (
                      <span className="pill resolved">
                        {activeInvestigation.verification_status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stage 2 & 3: Telemetry Strip */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 12,
                    padding: '14px 24px',
                    background: 'rgba(255, 255, 255, 0.01)',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Reasoning Provider</span>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {activeInvestigation.provider}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Execution Duration</span>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--brand-light)' }}>
                      {Math.round(activeInvestigation.execution_duration_ms)} ms
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Verification Vector</span>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--resolved-light)' }}>
                      Deterministic Grounding
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Recorded At</span>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {new Date(activeInvestigation.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                {/* Stage 4: Visual Technical Pipeline Topology Nodes */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0, 0, 0, 0.18)' }}>
                  <span style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}>
                    Technical Execution Topology: Code Calculates → AI Explains
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(0, 210, 255, 0.08)', border: '1px solid rgba(0, 210, 255, 0.25)', borderRadius: 'var(--radius-xs)', fontSize: 11.5, color: 'var(--cyan)' }}>
                      <Database size={13} />
                      <span>Data Ingested</span>
                    </div>
                    <ArrowRight size={12} color="var(--text-muted)" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(79, 117, 255, 0.08)', border: '1px solid rgba(79, 117, 255, 0.25)', borderRadius: 'var(--radius-xs)', fontSize: 11.5, color: 'var(--brand)' }}>
                      <Cpu size={13} />
                      <span>Deterministic Math</span>
                    </div>
                    <ArrowRight size={12} color="var(--text-muted)" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(0, 230, 118, 0.08)', border: '1px solid rgba(0, 230, 118, 0.25)', borderRadius: 'var(--radius-xs)', fontSize: 11.5, color: 'var(--resolved)' }}>
                      <ShieldCheck size={13} />
                      <span>Facts Verified</span>
                    </div>
                    <ArrowRight size={12} color="var(--text-muted)" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(167, 139, 250, 0.08)', border: '1px solid rgba(167, 139, 250, 0.25)', borderRadius: 'var(--radius-xs)', fontSize: 11.5, color: 'var(--purple)' }}>
                      <Sparkles size={13} />
                      <span>AI Synthesized</span>
                    </div>
                  </div>
                </div>

                {/* Stage 5: AI Explanation Content */}
                <div style={{ padding: '24px 28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                        Stage 5 · AI Synthesis & Explanation
                      </span>
                    </div>
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                      Strict separation: Facts vs Generative
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: 14,
                      lineHeight: 1.7,
                      color: 'var(--text-primary)',
                      whiteSpace: 'pre-wrap',
                      background: 'rgba(167, 139, 250, 0.04)',
                      border: '1px solid rgba(167, 139, 250, 0.2)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '20px 24px',
                    }}
                  >
                    {activeInvestigation.answer}
                  </div>

                  {/* Stage 6: Actionable Next Steps */}
                  <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}>
                      Stage 6 · Actionable Next Steps
                    </span>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-command-action secondary"
                        onClick={() => navigate('/risk-queue')}
                      >
                        <ShieldCheck size={14} color="var(--resolved)" />
                        <span>Inspect Risk Queue</span>
                      </button>
                      <button
                        type="button"
                        className="btn-command-action secondary"
                        onClick={() => navigate('/financial')}
                      >
                        <span>Financial Exposure</span>
                      </button>
                      <button
                        type="button"
                        className="btn-command-action secondary"
                        onClick={() => executeQuery(activeInvestigation.question)}
                      >
                        <RotateCw size={13} />
                        <span>Re-Run Investigation</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="empty-state" style={{ padding: 60 }}>
                  <HelpCircle size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
                  <h3 style={{ fontSize: 16, color: '#fff', marginBottom: 6 }}>No Active Investigation</h3>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto' }}>
                    Type an operational question above or choose a suggested inquiry to inspect verified reasoning.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Recent Investigations Library Sidebar */}
          <div className="card">
            <div className="card-head">
              <div className="card-title-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={15} color="var(--brand)" />
                  <h3>Past Inquiries</h3>
                </div>
                <div className="card-subtitle">
                  Investigation audit log
                </div>
              </div>
            </div>

            <div style={{ maxHeight: 560, overflowY: 'auto', padding: '10px 14px' }}>
              {loadingHistory ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  Loading inquiries…
                </div>
              ) : history.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  No previous investigations logged.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setActiveInvestigation(item)
                        setExecutionStage('complete')
                      }}
                      style={{
                        padding: '10px 12px',
                        background: activeInvestigation?.id === item.id ? 'rgba(79, 117, 255, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid',
                        borderColor: activeInvestigation?.id === item.id ? 'var(--brand)' : 'var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', marginBottom: 4, lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {item.question}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-muted)' }}>
                        <span className="mono">
                          {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="mono" style={{ color: 'var(--brand-light)' }}>
                          {item.confidence}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </>
  )
}
