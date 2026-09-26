import { ShieldCheck } from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'

export default function VerifiedBadge({ label, size = 'sm', className = '' }) {
  const { t } = useI18n()
  const displayLabel = label || t('global.verified') || 'VERIFIED FACT'

  return (
    <span
      className={`nexus-badge nexus-badge-verified ${size === 'xs' ? 'nexus-badge-xs' : ''} ${className}`}
      title="Authoritative metric derived deterministically from SQLite tables"
    >
      <ShieldCheck size={size === 'xs' ? 11 : 12} className="nexus-badge-icon" />
      <span>{displayLabel}</span>
    </span>
  )
}
