import { useState, useEffect, useMemo } from 'react'
import { NavLink, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  AlertTriangle,
  Boxes,
  Package,
  Receipt,
  MessageSquareText,
  TrendingUp,
  LineChart,
  FolderOpen,
  History,
  Archive,
  ArrowUpRight,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Cpu,
  LogOut,
} from 'lucide-react'
import { getCachedUserContext } from '../api.js'
import { useI18n } from '../i18n/index.jsx'

export default function Sidebar({
  isOpen,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
  tenantContext: propTenantContext,
  onLogout,
}) {
  const [internalTenantContext] = useState(getCachedUserContext)
  const tenantContext = propTenantContext || internalTenantContext
  const { t } = useI18n()

  const commandItems = useMemo(() => [
    { to: '/', label: t('sidebar.commandCenter'), icon: LayoutDashboard, end: true },
  ], [t])

  const operationsItems = useMemo(() => [
    { to: '/inventory', label: t('sidebar.inventoryIntelligence'), icon: Package },
    { to: '/products', label: t('sidebar.productCatalog'), icon: Boxes },
    { to: '/transactions', label: t('sidebar.transactionIntelligence'), icon: Receipt },
  ], [t])

  const intelligenceItems = useMemo(() => [
    { to: '/risk-queue', label: t('sidebar.riskIntelligence'), icon: AlertTriangle },
    { to: '/financial', label: t('sidebar.financialIntelligence'), icon: TrendingUp },
    { to: '/investigations', label: t('sidebar.investigations'), icon: MessageSquareText },
  ], [t])

  const governanceItems = useMemo(() => [
    { to: '/activity', label: t('sidebar.riskActivity'), icon: History },
    { to: '/saved-investigations', label: t('sidebar.savedInvestigations'), icon: Archive },
    { to: '/resources', label: t('sidebar.businessData'), icon: FolderOpen },
  ], [t])

  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside
        className={`sidebar ${isOpen ? 'mobile-open' : ''} ${isCollapsed ? 'sidebar-collapsed' : ''}`}
        aria-label="Operational Navigation"
      >
        {/* Brand Terminal Header */}
        <div className="sidebar-brand">
          <Link to="/" className="sidebar-brand-link" onClick={onClose}>
            <div className="sidebar-brand-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 20V4l16 16V4"
                  stroke="#3B82F6"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            {!isCollapsed && (
              <div className="sidebar-brand-text">
                <span className="sidebar-brand-word">NEXUS</span>
                <span className="sidebar-badge-version">v2.0</span>
              </div>
            )}
          </Link>

          {onToggleCollapse && (
            <button
              type="button"
              className="sidebar-collapse-toggle desktop-only"
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          )}

          {onClose && (
            <button
              type="button"
              className="sidebar-close-btn mobile-only"
              onClick={onClose}
              aria-label={t('global.close')}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Scrollable Navigation Body */}
        <div className="sidebar-scrollable-body">
          {/* 1. COMMAND */}
          <div className="sidebar-nav-section">
            {!isCollapsed && (
              <p className="sidebar-section-label">
                {t('sidebar.commandSection') || 'COMMAND'}
              </p>
            )}
            <nav className="sidebar-nav" aria-label="Command">
              {commandItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={onClose}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  title={isCollapsed ? label : undefined}
                >
                  <Icon size={16} className="sidebar-link-icon" />
                  {!isCollapsed && <span className="sidebar-link-text">{label}</span>}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* 2. OPERATIONS */}
          <div className="sidebar-nav-section">
            {!isCollapsed && (
              <p className="sidebar-section-label">
                {t('sidebar.operationsSection') || 'OPERATIONS'}
              </p>
            )}
            <nav className="sidebar-nav" aria-label="Operations">
              {operationsItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  title={isCollapsed ? label : undefined}
                >
                  <Icon size={16} className="sidebar-link-icon" />
                  {!isCollapsed && <span className="sidebar-link-text">{label}</span>}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* 3. INTELLIGENCE */}
          <div className="sidebar-nav-section">
            {!isCollapsed && (
              <p className="sidebar-section-label">
                {t('sidebar.intelligenceSection') || 'INTELLIGENCE'}
              </p>
            )}
            <nav className="sidebar-nav" aria-label="Intelligence">
              {intelligenceItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  title={isCollapsed ? label : undefined}
                >
                  <Icon size={16} className="sidebar-link-icon" />
                  {!isCollapsed && <span className="sidebar-link-text">{label}</span>}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* 4. GOVERNANCE & AUDIT */}
          <div className="sidebar-nav-section">
            {!isCollapsed && (
              <p className="sidebar-section-label">
                {t('sidebar.governanceSection') || 'GOVERNANCE'}
              </p>
            )}
            <nav className="sidebar-nav" aria-label="Governance">
              {governanceItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  title={isCollapsed ? label : undefined}
                >
                  <Icon size={16} className="sidebar-link-icon" />
                  {!isCollapsed && <span className="sidebar-link-text">{label}</span>}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* 5. FUTURE CAPABILITIES */}
          <div className="sidebar-nav-section">
            {!isCollapsed && (
              <p className="sidebar-section-label">
                {t('sidebar.futureSection') || 'FUTURE'}
              </p>
            )}
            <div className="sidebar-nav">
              <div
                className="sidebar-link sidebar-link-disabled"
                title={t('sidebar.marketIntelTooltip')}
                tabIndex={-1}
                aria-disabled="true"
              >
                <LineChart size={16} className="sidebar-link-icon" />
                {!isCollapsed && (
                  <>
                    <span className="sidebar-link-text">{t('sidebar.marketIntelligence')}</span>
                    <span className="sidebar-badge-planned">{t('sidebar.soon')}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tenant Identity Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-tenant">
            {!isCollapsed ? (
              <>
                <div className="sidebar-tenant-badge-row">
                  <span className="sidebar-tenant-name" title={tenantContext?.business_name || t('sidebar.verifiedTenant')}>
                    {tenantContext?.business_name || t('sidebar.verifiedTenant')}
                  </span>
                  <span className="sidebar-tenant-role-tag">
                    {tenantContext?.user?.role || 'OWNER'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                  <Link to="/landing" className="sidebar-landing-link" onClick={onClose} style={{ margin: 0 }}>
                    <span>{t('sidebar.productOverview')}</span>
                    <ArrowUpRight size={11} />
                  </Link>
                  {onLogout && (
                    <button
                      type="button"
                      onClick={onLogout}
                      className="sidebar-logout-btn"
                      title="Sign Out"
                      aria-label="Sign Out"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: 11,
                        padding: '2px 4px',
                        borderRadius: 3,
                        transition: 'color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      <LogOut size={12} />
                      <span>Exit</span>
                    </button>
                  )}
                </div>
                <div className="sidebar-live-telemetry">
                  <div className="status-dot-pulse-wrap">
                    <span className="status-dot-radar-ring" />
                    <span className="status-dot-pulse" style={{ width: 6, height: 6 }} />
                  </div>
                  <span className="sidebar-live-telemetry-text">API :8000 LIVE</span>
                </div>
              </>
            ) : (
              <div className="sidebar-collapsed-avatar" title={tenantContext?.business_name || 'Tenant'}>
                <ShieldCheck size={16} color="var(--brand-light)" />
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
