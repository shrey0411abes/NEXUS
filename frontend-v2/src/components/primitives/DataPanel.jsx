export default function DataPanel({
  children,
  title,
  subtitle,
  icon: Icon,
  badge,
  actions,
  variant = 'default', // 'default' | 'elevated' | 'glass' | 'subtle'
  className = '',
  bodyClassName = '',
  footer,
  style = {},
}) {
  return (
    <section className={`nexus-data-panel nexus-panel-${variant} ${className}`} style={style}>
      {(title || badge || actions) && (
        <header className="nexus-panel-header">
          <div className="nexus-panel-title-group">
            <div className="nexus-panel-title-row">
              {Icon && <Icon size={15} className="nexus-panel-icon" />}
              {title && <h3 className="nexus-panel-title">{title}</h3>}
              {badge}
            </div>
            {subtitle && <p className="nexus-panel-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="nexus-panel-actions">{actions}</div>}
        </header>
      )}

      <div className={`nexus-panel-body ${bodyClassName}`}>{children}</div>

      {footer && <footer className="nexus-panel-footer">{footer}</footer>}
    </section>
  )
}
