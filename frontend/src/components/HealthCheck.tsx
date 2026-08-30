import React, { useState, useEffect } from 'react';
import { fetchHealth } from '../services/api';
import { HealthResponse, ConnectionState } from '../types';

export const HealthCheck: React.FC = () => {
  const [state, setState] = useState<ConnectionState>('idle');
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkStatus = async () => {
    setState('checking');
    setErrorMessage(null);
    try {
      const data = await fetchHealth();
      setHealthData(data);
      setState('connected');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown connection error';
      setErrorMessage(message);
      setState('error');
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Backend API Health Status</h2>
        <div className={`status-indicator status-${state}`}>
          <span className="status-dot"></span>
          <span>{state.toUpperCase()}</span>
        </div>
      </div>

      {state === 'checking' && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Querying backend gateway at <code>/health</code>...
        </p>
      )}

      {state === 'error' && (
        <div>
          <p style={{ color: 'var(--status-error)', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
            Failed to connect to FastAPI backend: {errorMessage}
          </p>
          <button className="btn btn-secondary" onClick={checkStatus}>
            Retry Connection
          </button>
        </div>
      )}

      {state === 'connected' && healthData && (
        <div>
          <div className="metrics-grid" style={{ marginBottom: '1.25rem' }}>
            <div className="metric-item">
              <div className="metric-label">Service</div>
              <div className="metric-value">{healthData.service}</div>
            </div>
            <div className="metric-item">
              <div className="metric-label">Status</div>
              <div className="metric-value" style={{ color: 'var(--status-success)' }}>
                {healthData.status}
              </div>
            </div>
            <div className="metric-item">
              <div className="metric-label">Version</div>
              <div className="metric-value">{healthData.version}</div>
            </div>
            <div className="metric-item">
              <div className="metric-label">Environment</div>
              <div className="metric-value">{healthData.environment}</div>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={checkStatus}>
            Re-verify Health
          </button>
        </div>
      )}
    </div>
  );
};
