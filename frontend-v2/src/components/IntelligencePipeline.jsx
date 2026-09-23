import { useState } from 'react'
import {
  Database,
  Cpu,
  ShieldCheck,
  Sparkles,
  CheckCircle,
  ArrowRight,
} from 'lucide-react'
import { useI18n } from '../i18n/index.jsx'

export default function IntelligencePipeline() {
  const { t } = useI18n()

  const pipelineStages = [
    {
      id: 'stage-data',
      category: 'Ingestion Layer',
      title: t('dashboard.pipeline.stageDataSources'),
      icon: Database,
      status: 'ACTIVE',
      color: 'var(--cyan)',
      summary: t('dashboard.pipeline.stageDataSourcesDesc'),
      details: [
        'SQLite relational repository (products, inventory, transactions)',
        'Tenant-isolated row-level access security',
        'Zero synthetic metrics or simulated client state',
      ],
    },
    {
      id: 'stage-engines',
      category: 'Calculation Layer',
      title: t('dashboard.pipeline.stageEngines'),
      icon: Cpu,
      status: 'ACTIVE',
      color: 'var(--brand)',
      summary: t('dashboard.pipeline.stageEnginesDesc'),
      details: [
        'Pure mathematical calculations in Python / NumPy',
        'No generative models in the calculation path',
        'Code calculates — verifiable audit trail',
      ],
    },
    {
      id: 'stage-facts',
      category: 'Verification Layer',
      title: t('dashboard.pipeline.stageFacts'),
      icon: ShieldCheck,
      status: 'VERIFIED',
      color: 'var(--resolved)',
      summary: t('dashboard.pipeline.stageFactsDesc'),
      details: [
        'Reconciled KPI snapshots & priority score ranking',
        'Immutable state transitions recorded in SQLite audit table',
        'Client never recalculates or reinterprets totals',
      ],
    },
    {
      id: 'stage-ai',
      category: 'Intelligence Layer',
      title: t('dashboard.pipeline.stageAi'),
      icon: Sparkles,
      status: 'Grounded',
      color: 'var(--purple)',
      summary: t('dashboard.pipeline.stageAiDesc'),
      details: [
        'Grounded in live SQL query results & verified KPIs',
        'Calibrated confidence scores & verification status badges',
        'Strict separation: AI explains, never calculates',
      ],
    },
    {
      id: 'stage-action',
      category: 'Executive Layer',
      title: t('dashboard.pipeline.stageSupport'),
      icon: CheckCircle,
      status: 'Ready',
      color: 'var(--brand-light)',
      summary: t('dashboard.pipeline.stageSupportDesc'),
      details: [
        'One-click risk state transitions (Acknowledge / Resolve / Dismiss)',
        'Direct cross-domain investigation workflows',
        'Continuous audit logging for executive accountability',
      ],
    },
  ]

  const [selectedStageId, setSelectedStageId] = useState('stage-engines')
  const selectedStage = pipelineStages.find((s) => s.id === selectedStageId) || pipelineStages[1]

  return (
    <div className="pipeline-topology-wrap">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
              {t('landing.navTopology')}
            </span>
            <span className="command-status-badge" style={{ fontSize: 10 }}>
              <span className="status-dot-pulse" />
              LIVE ARCHITECTURE
            </span>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 3 }}>
            {t('dashboard.pipeline.title')}
          </h3>
        </div>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
          {t('dashboard.pipeline.subtitle')}
        </span>
      </div>

      {/* Visual Pipeline Nodes */}
      <div className="pipeline-diagram">
        {pipelineStages.map((stage, idx) => {
          const Icon = stage.icon
          const isSelected = selectedStage.id === stage.id
          return (
            <div key={stage.id} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 160 }}>
              <div
                className={`pipeline-node ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedStageId(stage.id)}
                style={{
                  cursor: 'pointer',
                  width: '100%',
                  borderColor: isSelected ? stage.color : undefined,
                  boxShadow: isSelected ? `0 0 16px rgba(79, 117, 255, 0.15)` : undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="pipeline-node-category">{stage.category}</span>
                  <span className="mono" style={{ fontSize: 9.5, color: stage.color, fontWeight: 600 }}>
                    {stage.status}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 2px' }}>
                  <Icon size={14} color={stage.color} />
                  <span className="pipeline-node-title" style={{ fontSize: 12 }}>
                    {stage.title}
                  </span>
                </div>
                <p className="pipeline-node-desc" style={{ fontSize: 11, lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {stage.summary}
                </p>
              </div>

              {idx < pipelineStages.length - 1 && (
                <div className="pipeline-connector" style={{ padding: '0 6px' }}>
                  <ArrowRight size={14} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Selected Node Detailed Architecture Explanation */}
      {selectedStage && (
        <div
          style={{
            marginTop: 16,
            padding: '14px 18px',
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="mono" style={{ fontSize: 10.5, color: selectedStage.color, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                {selectedStage.category}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>·</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#fff' }}>
                {selectedStage.title}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {selectedStage.summary}
            </p>
          </div>

          <div style={{ flex: 1.2, minWidth: 280 }}>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {selectedStage.details.map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: selectedStage.color }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
