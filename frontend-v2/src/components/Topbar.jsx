import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Search,
  RotateCw,
  Menu,
  ShieldAlert,
  ArrowUpRight,
  ShieldCheck,
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
      } else if (e.key === '/' && !['input', 'textarea'].includes(e.target.tagName.toLowerCase())) {
        e.preventDefault()
        setIsPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Format section breadcrumb cleanly
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
            <span className="topbar-breadcrumb-root">{t('global.appName')}</span>
            <span className="topbar-breadcrumb-sep">/</span>
            <span className="topbar-breadcrumb-current">{cleanTitle}</span>
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
              <Search size={14} />
              <span>{t('topbar.searchPlaceholder')}</span>
            </div>
            <kbd className="topbar-kbd">Ctrl K</kbd>
          </button>
        </div>

        <div className="topbar-right">
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
              हिन्दी
            </button>
          </div>

          {/* Refresh Action */}
          {onRefresh && (
            <button
              type="button"
              className="topbar-btn"
              onClick={onRefresh}
              disabled={isRefreshing}
              title={t('topbar.refreshTooltip')}
              aria-label={t('topbar.refreshTooltip')}
            >
              <RotateCw size={13} className={isRefreshing ? 'spin-anim' : ''} />
              <span>{isRefreshing ? t('global.refreshing') : t('global.refresh')}</span>
            </button>
          )}

          {/* Active Risk Pill */}
          {activeRiskCount != null && activeRiskCount > 0 && (
            <Link
              to="/risk-queue"
              className="topbar-risk-pill"
              title={`${activeRiskCount} ${t('topbar.riskPill', { count: activeRiskCount })}`}
            >
              <ShieldAlert size={13} />
              <span>
                {activeRiskCount === 1
                  ? t('topbar.riskPillSingular')
                  : t('topbar.riskPill', { count: activeRiskCount })}
              </span>
            </Link>
          )}

          {/* Verified Environment State */}
          <div className="command-status-badge" style={{ fontSize: 10.5 }} title={t('topbar.verifiedTooltip')}>
            <span className="status-dot-pulse" />
            <span>{t('global.verified')}</span>
          </div>

          {/* Role Chip */}
          <span className="topbar-role-badge">
            {userContext?.user?.role || t('topbar.roleOwner')}
          </span>

          {/* Landing / Overview link */}
          <Link to="/landing" className="topbar-btn" title={t('topbar.overviewTooltip')}>
            <span>{t('global.overview')}</span>
            <ArrowUpRight size={12} />
          </Link>
        </div>
      </header>

      {/* Mount Command Palette */}
      <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />
    </>
  )
}

