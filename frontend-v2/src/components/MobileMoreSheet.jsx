import { NavLink, Link } from 'react-router-dom'
import {
  Boxes,
  Receipt,
  TrendingUp,
  History,
  Archive,
  FolderOpen,
  ArrowUpRight,
  Globe,
  ShieldCheck,
} from 'lucide-react'
import BottomSheet from './primitives/BottomSheet.jsx'
import { useI18n } from '../i18n/index.jsx'

export default function MobileMoreSheet({
  isOpen,
  onClose,
  tenantContext,
}) {
  const { t, lang, setLang } = useI18n()

  const operationsLinks = [
    { to: '/products', label: t('sidebar.productCatalog'), icon: Boxes },
    { to: '/transactions', label: t('sidebar.transactionIntelligence'), icon: Receipt },
  ]

  const intelligenceLinks = [
    { to: '/financial', label: t('sidebar.financialIntelligence'), icon: TrendingUp },
  ]

  const governanceLinks = [
    { to: '/activity', label: t('sidebar.riskActivity'), icon: History },
    { to: '/saved-investigations', label: t('sidebar.savedInvestigations'), icon: Archive },
    { to: '/resources', label: t('sidebar.businessData'), icon: FolderOpen },
  ]

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t('global.appName') + ' · ' + (t('global.moreWorkspaces') || 'Navigation')}
      subtitle={t('sidebar.verifiedTenant')}
    >
      <div className="nexus-mobile-more-content">
        {/* Language Switcher Bar */}
        <div className="nexus-mobile-lang-bar">
          <div className="nexus-mobile-lang-label">
            <Globe size={14} />
            <span>{t('topbar.language') || 'Language'}</span>
          </div>
          <div className="topbar-lang-toggle" role="group" aria-label="Language selection">
            <button
              type="button"
              className={`topbar-lang-btn ${lang === 'en' ? 'active' : ''}`}
              onClick={() => setLang('en')}
              aria-pressed={lang === 'en'}
            >
              English
            </button>
            <span className="topbar-lang-divider" aria-hidden="true" />
            <button
              type="button"
              className={`topbar-lang-btn ${lang === 'hi' ? 'active' : ''}`}
              onClick={() => setLang('hi')}
              aria-pressed={lang === 'hi'}
            >
              हिन्दी
            </button>
          </div>
        </div>

        {/* OPERATIONS GROUP */}
        <div className="nexus-mobile-nav-group">
          <span className="nexus-mobile-nav-header">{t('sidebar.operationsSection') || 'OPERATIONS'}</span>
          <div className="nexus-mobile-nav-grid">
            {operationsLinks.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) => `nexus-mobile-sheet-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={16} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </div>

        {/* FINANCIAL INTELLIGENCE */}
        <div className="nexus-mobile-nav-group">
          <span className="nexus-mobile-nav-header">{t('sidebar.intelligenceSection') || 'INTELLIGENCE'}</span>
          <div className="nexus-mobile-nav-grid">
            {intelligenceLinks.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) => `nexus-mobile-sheet-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={16} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </div>

        {/* GOVERNANCE & AUDIT */}
        <div className="nexus-mobile-nav-group">
          <span className="nexus-mobile-nav-header">{t('sidebar.governanceSection') || 'GOVERNANCE & AUDIT'}</span>
          <div className="nexus-mobile-nav-grid">
            {governanceLinks.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) => `nexus-mobile-sheet-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={16} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </div>

        {/* TENANT FOOTER CARD */}
        <div className="nexus-mobile-tenant-card">
          <div className="nexus-mobile-tenant-meta">
            <span className="nexus-mobile-tenant-name">
              {tenantContext?.business_name || t('sidebar.verifiedTenant')}
            </span>
            <span className="nexus-mobile-tenant-sub">
              {t('sidebar.roleRbac', { role: tenantContext?.user?.role || 'OWNER' })}
            </span>
          </div>
          <Link to="/landing" className="sidebar-landing-link" onClick={onClose}>
            <span>{t('sidebar.productOverview')}</span>
            <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
    </BottomSheet>
  )
}
