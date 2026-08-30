import React, { useState } from 'react';
import { InvestigationRequest, InvestigationResponse } from '../types';
import { investigateBusiness } from '../services/api';

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

interface BusinessInvestigationProps {
  businessId: number | null;
}

export const BusinessInvestigation: React.FC<BusinessInvestigationProps> = ({ businessId }) => {
  const [question, setQuestion] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InvestigationResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !question.trim()) return;

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

  if (!businessId) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">AI Business Investigation</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--accent-purple)' }}>Phase 2 Engine</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Select a business above to enable natural-language investigation.
        </p>
      </div>
    );
  }

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

      {/* Error state */}
      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
          <p style={{ color: 'var(--status-error)', fontSize: '0.875rem', margin: 0 }}>
            ⚠ {error}
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <p style={{ color: 'var(--accent-cyan)', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>
          Retrieving verified analytics and generating grounded investigation...
        </p>
      )}

      {/* Result */}
      {result && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Answer + Confidence */}
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
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: CONFIDENCE_COLORS[result.confidence] || 'var(--text-secondary)',
                border: `1px solid ${CONFIDENCE_COLORS[result.confidence] || 'var(--border-color)'}`,
                borderRadius: '4px',
                padding: '0.1rem 0.5rem',
              }}>
                {result.confidence} CONFIDENCE
              </span>
            </div>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.925rem', lineHeight: '1.6', margin: 0 }}>
              {result.answer}
            </p>
          </div>

          {/* Key Findings */}
          {result.key_findings.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                KEY FINDINGS
              </h3>
              <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                {result.key_findings.map((f, i) => (
                  <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.3rem', lineHeight: '1.5' }}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                RECOMMENDED ACTIONS
              </h3>
              <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                {result.recommendations.map((r, i) => (
                  <li key={i} style={{ color: 'var(--accent-cyan)', fontSize: '0.875rem', marginBottom: '0.3rem', lineHeight: '1.5' }}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Supporting Facts */}
          {result.supporting_facts.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '6px', padding: '0.875rem 1rem' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                VERIFIED SUPPORTING FACTS
              </h3>
              <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                {result.supporting_facts.map((f, i) => (
                  <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.825rem', marginBottom: '0.25rem', fontFamily: 'monospace' }}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Limitations */}
          {result.limitations.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
                LIMITATIONS
              </h3>
              <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                {result.limitations.map((l, i) => (
                  <li key={i} style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.2rem' }}>{l}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
