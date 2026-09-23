import { useState, useEffect } from 'react'
import { Info, X } from 'lucide-react'
import { useI18n } from '../i18n/index.jsx'

export default function GuidanceBanner({ storageKey, messageKey }) {
  const { t } = useI18n()
  const fullKey = `nexus_guidance_${storageKey}`
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return localStorage.getItem(fullKey) === 'true'
    } catch {
      return false
    }
  })

  if (isDismissed) return null

  const handleDismiss = () => {
    setIsDismissed(true)
    try {
      localStorage.setItem(fullKey, 'true')
    } catch {
      // ignore
    }
  }

  return (
    <div className="guidance-banner" role="region" aria-label={t('guidance.firstTimeShopOwner')}>
      <div className="guidance-banner-content">
        <Info size={16} className="guidance-banner-icon" />
        <span>{t(messageKey)}</span>
      </div>
      <button
        type="button"
        className="guidance-dismiss-btn"
        onClick={handleDismiss}
        aria-label={t('guidance.dismiss')}
      >
        {t('guidance.dismiss')}
      </button>
    </div>
  )
}
