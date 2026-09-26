import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  AlertTriangle,
  Package,
  MessageSquareText,
  MoreHorizontal,
} from 'lucide-react'
import MobileMoreSheet from './MobileMoreSheet.jsx'
import { useI18n } from '../i18n/index.jsx'

export default function MobileBottomNav({ activeRiskCount = 0, tenantContext }) {
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const { t } = useI18n()

  const navItems = [
    {
      to: '/',
      label: t('sidebar.commandCenterShort') || 'Command',
      icon: LayoutDashboard,
      end: true,
    },
    {
      to: '/risk-queue',
      label: t('sidebar.risksShort') || 'Risks',
      icon: AlertTriangle,
      badge: activeRiskCount > 0 ? activeRiskCount : null,
    },
    {
      to: '/inventory',
      label: t('sidebar.inventoryShort') || 'Inventory',
      icon: Package,
    },
    {
      to: '/investigations',
      label: t('sidebar.aiShort') || 'Ask AI',
      icon: MessageSquareText,
    },
  ]

  return (
    <>
      <nav className="nexus-mobile-bottom-nav" aria-label="Mobile Navigation">
        {navItems.map(({ to, label, icon: Icon, badge, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `nexus-bottom-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <div className="nexus-bottom-nav-icon-wrap">
              <Icon size={18} />
              {badge !== null && badge !== undefined && (
                <span className="nexus-bottom-nav-badge">{badge}</span>
              )}
            </div>
            <span className="nexus-bottom-nav-label">{label}</span>
          </NavLink>
        ))}

        <button
          type="button"
          onClick={() => setIsMoreOpen(true)}
          className={`nexus-bottom-nav-item ${isMoreOpen ? 'active' : ''}`}
          aria-label={t('global.more') || 'More'}
        >
          <div className="nexus-bottom-nav-icon-wrap">
            <MoreHorizontal size={18} />
          </div>
          <span className="nexus-bottom-nav-label">{t('global.more') || 'More'}</span>
        </button>
      </nav>

      <MobileMoreSheet
        isOpen={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        tenantContext={tenantContext}
      />
    </>
  )
}
