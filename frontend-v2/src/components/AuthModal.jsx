import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Lock,
  Mail,
  Building2,
  Briefcase,
  ArrowRight,
  AlertCircle,
  X,
  ShieldCheck,
  Loader2,
} from 'lucide-react'
import { loginUser, registerUser, ApiError } from '../api.js'
import ActionButton from './primitives/ActionButton.jsx'
import VerifiedBadge from './primitives/VerifiedBadge.jsx'
import TechnicalLabel from './primitives/TechnicalLabel.jsx'
import { useI18n } from '../i18n/index.jsx'

export default function AuthModal({ isOpen = true, onClose, onAuthSuccess }) {
  const { t } = useI18n()
  const [tab, setTab] = useState('login') // 'login' | 'register'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Login form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register form state
  const [regBusinessName, setRegBusinessName] = useState('')
  const [regIndustry, setRegIndustry] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')

  if (!isOpen) return null

  const clearError = () => setError(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!loginEmail.trim() || !loginPassword) {
      setError('Please provide your email address and password.')
      return
    }

    setLoading(true)
    clearError()
    try {
      const data = await loginUser({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      })
      if (onAuthSuccess) {
        onAuthSuccess(data)
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError('Invalid email or password. Verify credentials.')
        else setError(err.message || 'Authentication failed. Please verify credentials.')
      } else {
        setError('Unable to connect to the backend server. Verify service is running.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!regBusinessName.trim() || !regIndustry.trim() || !regEmail.trim() || !regPassword) {
      setError('All registration fields are required.')
      return
    }

    setLoading(true)
    clearError()
    try {
      const data = await registerUser({
        business_name: regBusinessName.trim(),
        business_industry: regIndustry.trim(),
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
      })
      if (onAuthSuccess) {
        onAuthSuccess(data)
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) setError('An account with this email already exists. Please sign in.')
        else if (err.status === 422) setError(err.message || 'Invalid input. Check all registration fields.')
        else setError(err.message || 'Registration failed.')
      } else {
        setError('Unable to connect to the backend server.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="nexus-modal-portal"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      {/* Backdrop */}
      <div
        className="nexus-modal-backdrop"
        onClick={() => onClose && onClose()}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(5, 8, 15, 0.85)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      />

      {/* Modal Container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 440,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
          zIndex: 1001,
          overflow: 'hidden',
          animation: 'nexusFadeIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-panel)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  background: 'var(--brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                N
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '0.04em' }}>
                NEXUS WORKSTATION
              </h2>
              <TechnicalLabel value="JWT RBAC" variant="cyan" size="xs" />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              Tenant-isolated business intelligence operating environment.
            </p>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setTab('login')
              clearError()
            }}
            style={{
              flex: 1,
              padding: '10px',
              fontSize: 12.5,
              fontWeight: 600,
              background: tab === 'login' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
              color: tab === 'login' ? 'var(--brand-light)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: tab === 'login' ? '2px solid var(--brand)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register')
              clearError()
            }}
            style={{
              flex: 1,
              padding: '10px',
              fontSize: 12.5,
              fontWeight: 600,
              background: tab === 'register' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
              color: tab === 'register' ? 'var(--brand-light)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: tab === 'register' ? '2px solid var(--brand)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Register Business
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px' }}>
          {error && (
            <div
              style={{
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                borderRadius: 'var(--radius-xs)',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: 'var(--risk-light)',
                marginBottom: 16,
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  EMAIL ADDRESS
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Mail size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    required
                    placeholder="operator@company.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  PASSWORD
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Lock size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <ActionButton
                type="submit"
                variant="primary"
                loading={loading}
                style={{ marginTop: 4, width: '100%', padding: '10px' }}
              >
                Sign In to Workstation
              </ActionButton>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                  BUSINESS NAME
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Building2 size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    required
                    placeholder="Acme Retail Ltd"
                    value={regBusinessName}
                    onChange={(e) => setRegBusinessName(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                  INDUSTRY
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Briefcase size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    required
                    placeholder="Electronics / Retail / FMCG"
                    value={regIndustry}
                    onChange={(e) => setRegIndustry(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                  OPERATOR EMAIL
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Mail size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    required
                    placeholder="owner@acme.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                  PASSWORD (MIN 8 CHARS)
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Lock size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <ActionButton
                type="submit"
                variant="primary"
                loading={loading}
                style={{ marginTop: 6, width: '100%', padding: '10px' }}
              >
                Register & Initialize Tenant
              </ActionButton>
            </form>
          )}
        </div>

        {/* Footer Navigation Link */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-panel)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11.5,
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>Public Product Overview:</span>
          <Link
            to="/landing"
            onClick={onClose}
            style={{
              color: 'var(--cyan)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>Explore /landing</span>
            <ArrowRight size={11} />
          </Link>
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '8px 12px 8px 32px',
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-xs)',
  color: 'var(--text-primary)',
  fontSize: 12.5,
  outline: 'none',
  transition: 'border-color 0.15s ease',
}
