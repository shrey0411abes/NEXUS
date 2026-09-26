import React, { Component } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[NEXUS ErrorBoundary caught an exception]:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
    if (this.props.onRetry) {
      this.props.onRetry()
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          className="state-box error"
          role="alert"
          style={{
            minHeight: this.props.minHeight || 180,
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            background: 'var(--risk-bg)',
            border: '1px solid rgba(255, 77, 94, 0.25)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--risk-light)' }}>
            <AlertTriangle size={18} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              {this.props.title || 'Visualization Component Error'}
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 420, margin: 0, textAlign: 'center' }}>
            {this.props.message ||
              this.state.error?.message ||
              'A rendering exception occurred in this analytical module. Other workspace areas remain active.'}
          </p>
          <button
            type="button"
            className="btn-retry"
            onClick={this.handleRetry}
            style={{
              marginTop: 4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 'var(--radius-xs)',
              background: 'rgba(255, 77, 94, 0.15)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 500,
              border: '1px solid rgba(255, 77, 94, 0.35)',
              cursor: 'pointer',
            }}
          >
            <RotateCw size={12} />
            <span>Retry Visualization</span>
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
