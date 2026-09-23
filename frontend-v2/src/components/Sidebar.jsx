import { useState, useEffect, useMemo } from 'react'
import { NavLink, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  AlertTriangle,
  Package,
  Receipt,
  MessageSquareText,
  TrendingUp,
  LineChart,
  FolderOpen,
  FileSpreadsheet,
  History,
  Archive,
  ArrowUpRight,
  X,
} from 'lucide-react'
import { fetchCurrentUser, getCachedUserContext } from '../api.js'
import { useI18n } from '../i18n/index.jsx'

export default function Sidebar({ isOpen, onClose }) {
  const [tenantContext, setTenantContext] = useState(getCachedUserContext())
  const { t } = useI18n()

  useEffect(() => {
    let isMounted = true
    fetchCurrentUser()
      .then((data) => {
        if (isMounted) setTenantContext(data)
      })
      .catch(() => {
        // Unauthenticated or offline session fallback — no manufactured mock data
      })
    return () => {
      isMounted = false
    }
  }, [])

  const commandItems = useMemo(() => [
    { to: '/', label: t('sidebar.commandCenter'), icon: LayoutDashboard, end: true },
  ], [t])

  const intelligenceItems = useMemo(() => [
    { to: '/risk-queue', label: t('sidebar.riskIntelligence'), icon: AlertTriangle },
    { to: '/inventory', label: t('sidebar.inventoryIntelligence'), icon: Package },
    { to: '/financial', label: t('sidebar.financialIntelligence'), icon: TrendingUp },
    { to: '/transactions', label: t('sidebar.transactionIntelligence'), icon: Receipt },
    { to: '/investigations', label: t('sidebar.investigations'), icon: MessageSquareText },
  ], [t])

  const resourceItems = useMemo(() => [
    { to: '/resources', label: t('sidebar.businessData'), icon: FolderOpen },
    { to: '/resources?tab=reports', label: t('sidebar.reports'), icon: FileSpreadsheet },
    { to: '/activity', label: t('sidebar.riskActivity'), icon: History },
    { to: '/saved-investigations', label: t('sidebar.savedInvestigations'), icon: Archive },
  ], [t])

  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`} aria-label={t('sidebar.commandSection')}>
        <div className="sidebar-brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 20V4l16 16V4"
              stroke="#4C6FFF"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="sidebar-brand-word">{t('global.appName')}</span>
          <span className="sidebar-badge-planned" style={{ fontSize: 9, padding: '1px 5px' }}>v2.0</span>
          {onClose && (
            <button
              type="button"
              className="sidebar-close-btn"
              onClick={onClose}
              aria-label={t('global.close')}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* COMMAND */}
        <p className="sidebar-section-label">{t('sidebar.commandSection')}</p>
        <nav className="sidebar-nav" aria-label={t('sidebar.commandSection')}>
          {commandItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* INTELLIGENCE */}
        <p className="sidebar-section-label">{t('sidebar.intelligenceSection')}</p>
        <nav className="sidebar-nav" aria-label={t('sidebar.intelligenceSection')}>
          {intelligenceItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* RESOURCES */}
        <p className="sidebar-section-label">{t('sidebar.resourcesSection')}</p>
        <nav className="sidebar-nav" aria-label={t('sidebar.resourcesSection')}>
          {resourceItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* FUTURE */}
        <p className="sidebar-section-label">{t('sidebar.futureSection')}</p>
        <div className="sidebar-nav">
          <div
            className="sidebar-link sidebar-link-disabled"
            title={t('sidebar.marketIntelTooltip')}
            tabIndex={-1}
            aria-disabled="true"
          >
            <LineChart size={16} />
            <span>{t('sidebar.marketIntelligence')}</span>
            <span className="sidebar-badge-planned">{t('sidebar.soon')}</span>
          </div>
        </div>

        {/* BOTTOM / TENANT CONTEXT */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-tenant">
            <span className="sidebar-tenant-name" title={tenantContext?.business_name || t('sidebar.verifiedTenant')}>
              {tenantContext?.business_name || t('sidebar.verifiedTenant')}
            </span>
            <span className="sidebar-tenant-sub">
              {t('sidebar.roleRbac', { role: tenantContext?.user?.role || 'OWNER' })}
            </span>
            <Link to="/landing" className="sidebar-landing-link" onClick={onClose}>
              <span>{t('sidebar.productOverview')}</span>
              <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
      </aside>
    </>
  )
}

