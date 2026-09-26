import { Sparkles } from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'

export default function IntelligenceBadge({ label, size = 'sm', className = '' }) {
  const { t } = useI18n()
  const displayLabel = label || t('global.aiInterpretation') || 'AI INTERPRETATION'

  return (
    <span
      className={`nexus-badge nexus-badge-ai ${size === 'xs' ? 'nexus-badge-xs' : ''} ${className}`}
      title="Natural language contextualization grounded in verified database facts"
    >
      <Sparkles size={size === 'xs' ? 11 : 12} className="nexus-badge-icon" />
      <span>{displayLabel}</span>
    </span>
  )
}
