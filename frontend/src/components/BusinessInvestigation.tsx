import React, { useState, useEffect, useCallback } from 'react';
import {
  InvestigationRequest,
  InvestigationResponse,
  InvestigationAuditSummary,
  InvestigationAuditDetail,
} from '../types';
import {
  investigateBusiness,
  fetchInvestigationHistory,
  fetchInvestigationDetail,
} from '../services/api';

const EXAMPLE_QUESTIONS = [
  'What should I reorder this week?',
  'Which products need immediate attention?',
  'What are my biggest inventory concerns?',
  'Why is my revenue trending the way it is?',
];

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: 'var(--status-success)',
  MEDIUM: 'var(--accent-cyan)',
  LOW: 'var(--status-pending)',
};

const CONFIDENCE_BG: Record<string, string> = {
  HIGH: 'rgba(34,197,94,0.10)',
  MEDIUM: 'rgba(100,220,255,0.10)',
  LOW: 'rgba(251,191,36,0.10)',
};

type ActiveTab = 'investigate' | 'history';

interface BusinessInvestigationProps {
  businessId: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── Confidence Badge ─────────────────────────────────────────────────────────

const ConfidenceBadge: React.FC<{ confidence: string }> = ({ confidence }) => (
  <span
    style={{
      fontSize: '0.72rem',
      fontWeight: 700,
      color: CONFIDENCE_COLORS[confidence] || 'var(--text-secondary)',
      background: CONFIDENCE_BG[confidence] || 'rgba(255,255,255,0.05)',
      border: `1px solid ${CONFIDENCE_COLORS[confidence] || 'var(--border-color)'}`,
      borderRadius: '4px',
      padding: '0.1rem 0.45rem',
      letterSpacing: '0.04em',
    }}
  >
    {confidence}
  </span>
);

// ─── Result Panel (new investigation answer) ──────────────────────────────────

const InvestigationResultPanel: React.FC<{ result: InvestigationResponse }> = ({ result }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    <div style={{
      background: 'rgba(100, 220, 255, 0.04)',
      border: '1px solid rgba(100, 220, 255, 0.15)',
      borderRadius: '8px',
      padding: '1.25rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          INVESTIGATION ANSWER
        </span>
        <ConfidenceBadge confidence={result.confidence} />
      </div>
      <p style={{ color: 'var(--text-primary)', fontSize: '0.925rem', lineHeight: '1.6', margin: 0 }}>
        {result.answer}
      </p>
    </div>

    {result.key_findings.length > 0 && (
      <div>
        <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>KEY FINDINGS</h3>
        <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
          {result.key_findings.map((f, i) => (
            <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.3rem', lineHeight: '1.5' }}>{f}</li>
          ))}
        </ul>
      </div>
    )}

    {result.recommendations.length > 0 && (
      <div>
        <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>RECOMMENDED ACTIONS</h3>
        <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
          {result.recommendations.map((r, i) => (
            <li key={i} style={{ color: 'var(--accent-cyan)', fontSize: '0.875rem', marginBottom: '0.3rem', lineHeight: '1.5' }}>{r}</li>
          ))}
        </ul>
      </div>
    )}

    {result.supporting_facts.length > 0 && (
      <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '6px', padding: '0.875rem 1rem' }}>
        <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>VERIFIED SUPPORTING FACTS</h3>
        <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
          {result.supporting_facts.map((f, i) => (
            <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.825rem', marginBottom: '0.25rem', fontFamily: 'monospace' }}>{f}</li>
          ))}
        </ul>
      </div>
    )}

    {result.limitations.length > 0 && (
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
        <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>LIMITATIONS</h3>
        <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
          {result.limitations.map((l, i) => (
            <li key={i} style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.2rem' }}>{l}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

// ─── History Panel ────────────────────────────────────────────────────────────

interface HistoryPanelProps {
  history: InvestigationAuditSummary[];
  historyLoading: boolean;
  historyError: string | null;
  selectedDetail: InvestigationAuditDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  onSelectItem: (id: number) => void;
  onRefresh: () => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history, historyLoading, historyError,
  selectedDetail, detailLoading, detailError,
  onSelectItem, onRefresh,
}) => {
  if (historyLoading) {
    return (
      <p style={{ color: 'var(--accent-cyan)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>
        Loading investigation history…
      </p>
    );
  }

  if (historyError) {
    return (
      <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '1rem' }}>
        <p style={{ color: 'var(--status-error)', fontSize: '0.875rem', margin: 0 }}>⚠ {historyError}</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem', opacity: 0.4 }}>🔍</div>
        <p style={{ margin: 0 }}>No investigation history yet.</p>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>Submit your first question in the Investigate tab.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.25rem' }}>
        <button
          id="investigation-history-refresh-btn"
          onClick={onRefresh}
          style={{
            background: 'rgba(100,220,255,0.06)',
            border: '1px solid rgba(100,220,255,0.2)',
            borderRadius: '6px',
            padding: '0.25rem 0.75rem',
            fontSize: '0.78rem',
            color: 'var(--accent-cyan)',
            cursor: 'pointer',
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {history.map((item) => (
        <button
          key={item.id}
          id={`investigation-history-item-${item.id}`}
          onClick={() => onSelectItem(item.id)}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            background: selectedDetail?.id === item.id ? 'rgba(100,220,255,0.08)' : 'rgba(255,255,255,0.02)',
            border: selectedDetail?.id === item.id ? '1px solid rgba(100,220,255,0.35)' : '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '0.875rem 1rem',
            cursor: 'pointer',
            transition: 'background 0.15s ease, border-color 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 500, lineHeight: '1.4', flexShrink: 1 }}>
              {item.question}
            </span>
            <ConfidenceBadge confidence={item.confidence} />
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            <span>{formatRelativeTime(item.created_at)}</span>
            <span>{formatDuration(item.execution_duration_ms)}</span>
            <span style={{ textTransform: 'uppercase', letterSpacing: '0.03em' }}>{item.provider}</span>
            <span>{item.verification_status}</span>
          </div>
        </button>
      ))}

      {detailLoading && (
        <p style={{ color: 'var(--accent-cyan)', fontSize: '0.875rem', textAlign: 'center', padding: '1rem', marginTop: '0.5rem' }}>
          Loading detail…
        </p>
      )}

      {detailError && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.875rem', marginTop: '0.5rem' }}>
          <p style={{ color: 'var(--status-error)', fontSize: '0.875rem', margin: 0 }}>⚠ {detailError}</p>
        </div>
      )}

      {selectedDetail && !detailLoading && !detailError && (
        <div
          id={`investigation-detail-panel-${selectedDetail.id}`}
          style={{
            marginTop: '0.5rem',
            background: 'rgba(100,220,255,0.03)',
            border: '1px solid rgba(100,220,255,0.15)',
            borderRadius: '10px',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              INVESTIGATION #{selectedDetail.id} — FULL RECORD
            </span>
            <ConfidenceBadge confidence={selectedDetail.confidence} />
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic', marginBottom: '0.75rem' }}>
            "{selectedDetail.question}"
          </p>

          <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '1rem' }}>
            {selectedDetail.answer}
          </p>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
            <span>Provider: {selectedDetail.provider}</span>
            <span>Duration: {formatDuration(selectedDetail.execution_duration_ms)}</span>
            <span>Verified: {selectedDetail.verification_status}</span>
            <span>{new Date(selectedDetail.created_at).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const BusinessInvestigation: React.FC<BusinessInvestigationProps> = ({ businessId }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('investigate');

  // Investigate tab state
  const [question, setQuestion] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InvestigationResponse | null>(null);

  // History tab state
  const [history, setHistory] = useState<InvestigationAuditSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<InvestigationAuditDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    setSelectedDetail(null);
    try {
      const data = await fetchInvestigationHistory(50, 0);
      setHistory(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load history.';
      setHistoryError(msg);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Load history whenever the history tab becomes active
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  const handleSelectItem = async (id: number) => {
    if (selectedDetail?.id === id) {
      setSelectedDetail(null);
      return;
    }
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await fetchInvestigationDetail(id);
      setSelectedDetail(detail);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load detail.';
      setDetailError(msg);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const req: InvestigationRequest = { business_id: businessId, question: question.trim() };
      const response = await investigateBusiness(req);
      setResult(response);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Investigation failed. Please retry.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const tabStyle = (tab: ActiveTab): React.CSSProperties => ({
    background: activeTab === tab ? 'rgba(100,220,255,0.10)' : 'transparent',
    border: activeTab === tab ? '1px solid rgba(100,220,255,0.3)' : '1px solid transparent',
    borderRadius: '6px',
    padding: '0.35rem 1rem',
    fontSize: '0.82rem',
    fontWeight: activeTab === tab ? 700 : 500,
    color: activeTab === tab ? 'var(--accent-cyan)' : 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  });

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">AI Business Investigation</h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--accent-purple)' }}>
          Grounded in Verified NEXUS Analytics
        </span>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: '1.5' }}>
        Ask natural-language business questions. The AI interprets <strong>verified deterministic analytics</strong> —
        it does not fabricate numbers or invent business data.
      </p>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <button id="investigation-tab-investigate" style={tabStyle('investigate')} onClick={() => setActiveTab('investigate')}>
          🔍 Investigate
        </button>
        <button id="investigation-tab-history" style={tabStyle('history')} onClick={() => setActiveTab('history')}>
          🕐 History
        </button>
      </div>

      {/* ── Investigate Tab ── */}
      {activeTab === 'investigate' && (
        <>
          {/* Example questions */}
          <div style={{ marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
              EXAMPLE QUESTIONS:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuestion(q)}
                  style={{
                    background: 'rgba(100, 220, 255, 0.06)',
                    border: '1px solid rgba(100, 220, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.8rem',
                    color: 'var(--accent-cyan)',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Question input form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <input
              id="investigation-question-input"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a business question..."
              disabled={loading}
              style={{
                flex: '1 1 300px',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '0.6rem 1rem',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
            <button
              id="investigation-submit-btn"
              type="submit"
              disabled={loading || !question.trim()}
              style={{
                background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
                border: 'none',
                borderRadius: '8px',
                padding: '0.6rem 1.5rem',
                color: '#0d1117',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: loading || !question.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !question.trim() ? 0.5 : 1,
                transition: 'opacity 0.15s ease',
              }}
            >
              {loading ? 'Investigating...' : 'Investigate'}
            </button>
          </form>

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ color: 'var(--status-error)', fontSize: '0.875rem', margin: 0 }}>⚠ {error}</p>
            </div>
          )}

          {loading && (
            <p style={{ color: 'var(--accent-cyan)', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>
              Retrieving verified analytics and generating grounded investigation…
            </p>
          )}

          {result && !loading && <InvestigationResultPanel result={result} />}
        </>
      )}

      {/* ── History Tab ── */}
      {activeTab === 'history' && (
        <HistoryPanel
          history={history}
          historyLoading={historyLoading}
          historyError={historyError}
          selectedDetail={selectedDetail}
          detailLoading={detailLoading}
          detailError={detailError}
          onSelectItem={handleSelectItem}
          onRefresh={loadHistory}
        />
      )}
    </div>
  );
};
