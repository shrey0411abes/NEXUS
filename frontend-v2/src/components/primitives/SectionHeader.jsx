import { useI18n } from '../../i18n/index.jsx'

export default function SectionHeader({
  meta,
  title,
  description,
  badge,
  actions,
  className = '',
}) {
  const { t } = useI18n()

  return (
    <div className={`nexus-section-header ${className}`}>
      <div className="nexus-section-header-left">
        <div className="nexus-section-header-meta">
          {meta && <span className="nexus-section-meta-text">{meta}</span>}
          {badge || (
            <span className="nexus-live-status-pill">
              <span className="nexus-status-pulse-dot" />
              <span>{t('global.deterministic') || 'SQLITE DETERMINISTIC'}</span>
            </span>
          )}
        </div>
        {title && <h1 className="nexus-section-title">{title}</h1>}
        {description && <p className="nexus-section-desc">{description}</p>}
      </div>

      {actions && <div className="nexus-section-actions">{actions}</div>}
    </div>
  )
}
