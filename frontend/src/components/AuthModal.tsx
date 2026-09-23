import React, { useState } from 'react';
import { loginUser, registerUser, ApiError } from '../services/api';
import { TokenResponse, LoginRequest, RegisterRequest } from '../types';

interface AuthModalProps {
  onAuthSuccess: (data: TokenResponse) => void;
}

type AuthTab = 'login' | 'register';

export const AuthModal: React.FC<AuthModalProps> = ({ onAuthSuccess }) => {
  const [tab, setTab] = useState<AuthTab>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regBusinessName, setRegBusinessName] = useState('');
  const [regIndustry, setRegIndustry] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const clearError = () => setError(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearError();
    try {
      const req: LoginRequest = { email: loginEmail.trim().toLowerCase(), password: loginPassword };
      const data = await loginUser(req);
      onAuthSuccess(data);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError('Invalid email or password.');
        else setError(err.message || 'Login failed. Please try again.');
      } else {
        setError('Unable to connect. Is the backend running?');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearError();
    try {
      const req: RegisterRequest = {
        business_name: regBusinessName.trim(),
        business_industry: regIndustry.trim(),
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
      };
      const data = await registerUser(req);
      onAuthSuccess(data);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) setError('An account with that email already exists. Please log in.');
        else if (err.status === 422) setError(err.message || 'Invalid input. Check all fields.');
        else setError(err.message || 'Registration failed. Please try again.');
      } else {
        setError('Unable to connect. Is the backend running?');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay">
      <div className="auth-modal">
        {/* Header */}
        <div className="auth-modal-header">
          <div className="brand-badge" style={{ marginBottom: '0.5rem' }}>NEXUS · Milestone 1</div>
          <h1 className="app-title" style={{ fontSize: '2rem', margin: '0 0 0.25rem' }}>NEXUS</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
            AI Business Operating System
          </p>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); clearError(); }}
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => { setTab('register'); clearError(); }}
          >
            Register Business
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="auth-error">
            <span>⚠ {error}</span>
            <button className="auth-error-dismiss" onClick={clearError}>×</button>
          </div>
        )}

        {/* Login Form */}
        {tab === 'login' && (
          <form className="auth-form" onSubmit={handleLogin} noValidate>
            <div className="auth-field">
              <label htmlFor="login-email">Email Address</label>
              <input
                id="login-email"
                type="email"
                placeholder="you@company.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                placeholder="Your password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading || !loginEmail || !loginPassword}
            >
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>
        )}

        {/* Register Form */}
        {tab === 'register' && (
          <form className="auth-form" onSubmit={handleRegister} noValidate>
            <div className="auth-field">
              <label htmlFor="reg-business-name">Business Name</label>
              <input
                id="reg-business-name"
                type="text"
                placeholder="Acme Retail Co."
                value={regBusinessName}
                onChange={(e) => setRegBusinessName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="reg-industry">Industry</label>
              <input
                id="reg-industry"
                type="text"
                placeholder="e.g. Retail, Grocery, Electronics"
                value={regIndustry}
                onChange={(e) => setRegIndustry(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="reg-email">Owner Email</label>
              <input
                id="reg-email"
                type="email"
                placeholder="owner@company.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                type="password"
                placeholder="Min 8 chars, at least one letter & number"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                disabled={loading}
              />
              <span className="auth-field-hint">Min 8 characters · at least one letter and one number</span>
            </div>
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading || !regBusinessName || !regIndustry || !regEmail || !regPassword}
            >
              {loading ? 'Creating account…' : 'Create Business →'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
