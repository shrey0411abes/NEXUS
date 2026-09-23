import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Compass, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import { useI18n } from '../i18n/index.jsx'

export default function GettingStartedCard() {
  const { t } = useI18n()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('nexus_getting_started_collapsed') === 'true'
    } catch {
      return false
    }
  })

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('nexus_getting_started_collapsed', String(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  return (
    <div className="getting-started-card">
      <div
        className="getting-started-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={toggleCollapse}
      >
        <div>
          <h2 className="getting-started-title">
            <Compass size={18} color="var(--brand-light)" />
            <span>{t('gettingStarted.title')}</span>
          </h2>
          <p className="getting-started-subtitle">{t('gettingStarted.subtitle')}</p>
        </div>
        <button
          type="button"
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>

      {!collapsed && (
        <div className="getting-started-steps">
          <div className="getting-started-step">
            <div>
              <span className="getting-started-step-num">Step 01</span>
              <h3 className="getting-started-step-title" style={{ marginTop: 4 }}>{t('gettingStarted.step1Title')}</h3>
              <p className="getting-started-step-desc" style={{ marginTop: 6 }}>{t('gettingStarted.step1Desc')}</p>
            </div>
            <Link to="/resources" className="getting-started-step-btn">
              <span>{t('gettingStarted.step1Action')}</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          <div className="getting-started-step">
            <div>
              <span className="getting-started-step-num">Step 02</span>
              <h3 className="getting-started-step-title" style={{ marginTop: 4 }}>{t('gettingStarted.step2Title')}</h3>
              <p className="getting-started-step-desc" style={{ marginTop: 6 }}>{t('gettingStarted.step2Desc')}</p>
            </div>
            <Link to="/inventory" className="getting-started-step-btn">
              <span>{t('gettingStarted.step2Action')}</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          <div className="getting-started-step">
            <div>
              <span className="getting-started-step-num">Step 03</span>
              <h3 className="getting-started-step-title" style={{ marginTop: 4 }}>{t('gettingStarted.step3Title')}</h3>
              <p className="getting-started-step-desc" style={{ marginTop: 6 }}>{t('gettingStarted.step3Desc')}</p>
            </div>
            <Link to="/transactions" className="getting-started-step-btn">
              <span>{t('gettingStarted.step3Action')}</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          <div className="getting-started-step">
            <div>
              <span className="getting-started-step-num">Step 04</span>
              <h3 className="getting-started-step-title" style={{ marginTop: 4 }}>{t('gettingStarted.step4Title')}</h3>
              <p className="getting-started-step-desc" style={{ marginTop: 6 }}>{t('gettingStarted.step4Desc')}</p>
            </div>
            <Link to="/risk-queue" className="getting-started-step-btn">
              <span>{t('gettingStarted.step4Action')}</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
