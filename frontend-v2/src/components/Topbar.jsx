import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  Menu,
  AlertTriangle,
  Database,
  ArrowRight,
  RotateCw,
} from 'lucide-react'
import { getCachedUserContext } from '../api.js'
import { useI18n } from '../i18n/index.jsx'
import CommandPalette from './CommandPalette.jsx'

export default function Topbar({
  title = 'Command Center',
  subtitle,
  onRefresh,
  isRefreshing = false,
  activeRiskCount,
  onToggleMobileMenu,
}) {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const userContext = getCachedUserContext()
  const { lang, setLang, t } = useI18n()

  // Global Ctrl+K / Cmd+K listener to toggle command palette
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsPaletteOpen((prev) => !prev)
      } else if (e.key === '/' && !['input', 'textarea'].includes(e.target.tagName?.toLowerCase())) {
        e.preventDefault()
        setIsPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const cleanTitle = title.replace(/^NEXUS\s+/i, '').toUpperCase()

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          {onToggleMobileMenu && (
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={onToggleMobileMenu}
              aria-label="Open navigation menu"
            >
              <Menu size={18} />
            </button>
          )}

          <div className="topbar-breadcrumb">
            <Link to="/" className="topbar-breadcrumb-root">NEXUS</Link>
            <span className="topbar-breadcrumb-sep">/</span>
            <span className="topbar-breadcrumb-current">{cleanTitle}</span>
          </div>

          <div className="topbar-engine-tag desktop-only">
            <div className="status-dot-pulse-wrap" style={{ width: 8, height: 8 }}>
              <span className="status-dot-radar-ring" />
              <span className="status-dot-pulse" style={{ width: 6, height: 6 }} />
            </div>
            <span>SQLITE WAL</span>
          </div>
        </div>

        {/* Global Command Palette Trigger */}
        <div className="topbar-center">
          <button
            type="button"
            className="topbar-search-trigger"
            onClick={() => setIsPaletteOpen(true)}
            aria-label="Open Command Palette (Ctrl+K)"
          >
            <div className="topbar-search-left">
              <Search size={14} className="topbar-search-icon" />
              <span className="topbar-search-placeholder">
                {t('topbar.searchPlaceholder') || 'Search NEXUS, commands, or ask AI...'}
              </span>
            </div>
            <kbd className="topbar-kbd">Ctrl K</kbd>
          </button>
        </div>

        <div className="topbar-right">
          {/* Refresh Action Trigger */}
          {onRefresh && (
            <button
              type="button"
              className="topbar-action-btn"
              onClick={onRefresh}
              disabled={isRefreshing}
              title={isRefreshing ? t('global.refreshing') || 'Refreshing…' : t('global.refresh') || 'Refresh'}
              aria-label={t('global.refresh') || 'Refresh data'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-xs)',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                color: isRefreshing ? 'var(--brand-light)' : 'var(--text-secondary)',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <RotateCw
                size={14}
                style={{
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                }}
              />
            </button>
          )}

          {/* Active Risks Quick Pill */}
          {activeRiskCount > 0 && (
            <Link
              to="/risk-queue"
              className="topbar-risk-pill"
              title={`${activeRiskCount} active risks pending attention`}
            >
              <div className="status-dot-pulse-wrap" style={{ width: 8, height: 8 }}>
                <span className="status-dot-radar-ring risk" />
                <span className="status-dot-pulse" style={{ width: 6, height: 6, background: '#f43f5e' }} />
              </div>
              <AlertTriangle size={12} />
              <span>{activeRiskCount}</span>
            </Link>
          )}

          {/* Language Selector Toggle */}
          <div className="topbar-lang-toggle" role="group" aria-label="Language selection">
            <button
              type="button"
              className={`topbar-lang-btn ${lang === 'en' ? 'active' : ''}`}
              onClick={() => setLang('en')}
              aria-pressed={lang === 'en'}
              aria-label="Switch to English"
            >
              EN
            </button>
            <span className="topbar-lang-divider" aria-hidden="true" />
            <button
              type="button"
              className={`topbar-lang-btn ${lang === 'hi' ? 'active' : ''}`}
              onClick={() => setLang('hi')}
              aria-pressed={lang === 'hi'}
              aria-label="हिन्दी में बदलें"
            >
              HI
            </button>
          </div>
        </div>
      </header>

      {/* Global Command Palette Modal */}
      <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />
    </>
  )
}
