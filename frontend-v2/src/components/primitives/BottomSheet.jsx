import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className = '',
}) {
  const { t } = useI18n()
  const sheetRef = useRef(null)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="nexus-sheet-overlay" onClick={onClose} role="presentation">
      <div
        ref={sheetRef}
        className={`nexus-sheet-container ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Contextual Sheet'}
      >
        <div className="nexus-sheet-handle-bar">
          <div className="nexus-sheet-handle" />
        </div>

        {(title || onClose) && (
          <header className="nexus-sheet-header">
            <div>
              {title && <h3 className="nexus-sheet-title">{title}</h3>}
              {subtitle && <p className="nexus-sheet-subtitle">{subtitle}</p>}
            </div>
            <button
              type="button"
              className="nexus-sheet-close-btn"
              onClick={onClose}
              aria-label={t('global.close') || 'Close'}
            >
              <X size={18} />
            </button>
          </header>
        )}

        <div className="nexus-sheet-body">{children}</div>

        {footer && <footer className="nexus-sheet-footer">{footer}</footer>}
      </div>
    </div>
  )
}
