import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FolderOpen,
  Package,
  Receipt,
  TrendingUp,
  AlertTriangle,
  MessageSquareText,
  History,
  ShieldCheck,
  Database,
  Cpu,
  Layers,
  ArrowRight,
  BookOpen,
  FileCheck,
  Coins,
  CheckCircle2,
  GitBranch,
} from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import {
  DataPanel,
  SectionHeader,
  VerifiedBadge,
  IntelligenceBadge,
  TechnicalLabel,
  StatusIndicator,
  ActionButton,
  InsightCallout,
} from '../components/primitives/index.js'

const LIFECYCLE_MAP = [
  {
    id: 'data',
    title: '1. DATA INGESTION',
    subtitle: 'Authoritative Sources',
    icon: Database,
    color: '#06b6d4',
    principles: [
      'SQLite physical tables: products, inventory, transactions',
      'Tenant isolation derived strictly from verified JWT tokens',
      'Immutable transaction records with Decimal arithmetic precision',
    ],
    route: '/inventory',
    routeLabel: 'Inspect Inventory Telemetry',
  },
  {
    id: 'analytics',
    title: '2. DETERMINISTIC ANALYTICS',
    subtitle: 'Mathematical Authority',
    icon: Cpu,
    color: '#3b82f6',
    principles: [
      '14-day moving average daily sales velocity comparison',
      'Zero synthetic math: generative AI never calculates metrics',
      'Deterministic SQLite queries calculate all revenue and volume',
    ],
    route: '/',
    routeLabel: 'Open Business Pulse',
  },
  {
    id: 'risk',
    title: '3. CROSS-DOMAIN RISK',
    subtitle: 'Collision Detection',
    icon: AlertTriangle,
    color: '#f43f5e',
    principles: [
      'Multi-domain collision between velocity drops, stockouts, and capital',
      'Dynamic priority scoring and integer rank calculation (#01, #02, etc.)',
      'Clear severity triage: Critical High, Moderate, and Low Watch',
    ],
    route: '/risk-queue',
    routeLabel: 'Launch Risk Queue',
  },
  {
    id: 'financial',
    title: '4. FINANCIAL INTELLIGENCE',
    subtitle: 'Capital Exposure Modeling',
    icon: Coins,
    color: '#f59e0b',
    principles: [
      'Daily stockout revenue exposure and 7d/30d projection runway',
      'Trapped retail capital calculation for stagnant inventory',
      'Retail asset valuation on hand per active SKU',
    ],
    route: '/financial',
    routeLabel: 'Open Financial Terminal',
  },
  {
    id: 'investigation',
    title: '5. GROUNDED INVESTIGATION',
    subtitle: 'Reasoning Console',
    icon: MessageSquareText,
    color: '#a855f7',
    principles: [
      'Natural language query parsed into verified SQL constraints',
      'AI synthesis explains verified business facts in plain language',
      'Confidence calibration and execution duration telemetry',
    ],
    route: '/investigations',
    routeLabel: 'Launch AI Workspace',
  },
  {
    id: 'action',
    title: '6. OPERATIONAL ACTION',
    subtitle: 'State Reconciliation',
    icon: CheckCircle2,
    color: '#10b981',
    principles: [
      'Deterministic lifecycle transitions: OPEN → ACKNOWLEDGED → RESOLVED',
      'Action notes and tenant actor attribution preserved per action',
      'Direct one-click triage triggers on command surfaces',
    ],
    route: '/risk-queue',
    routeLabel: 'Review Open Risks',
  },
  {
    id: 'audit',
    title: '7. IMMUTABLE AUDIT',
    subtitle: 'Compliance & History',
    icon: ShieldCheck,
    color: '#06b6d4',
    principles: [
      'Append-only audit trail in risk_actions table',
      'Zero destructive updates: history is preserved perpetually',
      'Chronological timeline stream searchable by actor and SKU',
    ],
    route: '/activity',
    routeLabel: 'Audit Stream',
  },
]

export default function Resources({ onToggleMobileMenu }) {
  const [selectedPhase, setSelectedPhase] = useState('data')

  const currentPhase = LIFECYCLE_MAP.find((p) => p.id === selectedPhase) || LIFECYCLE_MAP[0]

  return (
    <>
      <Topbar onToggleMobileMenu={onToggleMobileMenu} />

      <div className="page-content">
        {/* Section Header */}
        <SectionHeader
          meta="ARCHITECTURE KNOWLEDGE MAP"
          title="NEXUS Operating Architecture"
          description="Explore the end-to-end intelligence cycle: from raw SQLite data ingestion to deterministic analytics, risk collision, financial exposure, grounded AI investigation, action, and immutable audit."
          badge={<VerifiedBadge />}
        />

        {/* ── Interactive Lifecycle Topology Map ───────────────────────── */}
        <div
          style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '20px',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <GitBranch size={16} color="var(--cyan)" />
              <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                NEXUS KNOWLEDGE TOPOLOGY MAP
              </span>
            </div>
            <TechnicalLabel value="SYSTEM V2.0" variant="cyan" size="xs" />
          </div>

          {/* Interactive Topology Nodes */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              overflowX: 'auto',
              gap: 8,
              padding: '6px 0 10px',
            }}
          >
            {LIFECYCLE_MAP.map((phase, idx) => {
              const Icon = phase.icon
              const isSelected = selectedPhase === phase.id

              return (
                <div key={phase.id} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 130 }}>
                  <div
                    onClick={() => setSelectedPhase(phase.id)}
                    style={{
                      background: isSelected ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: isSelected ? '1px solid var(--cyan)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-xs)',
                      padding: '10px',
                      flex: 1,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 0 12px rgba(6, 182, 212, 0.2)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Icon size={13} color={phase.color} />
                      <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {phase.title.split('. ')[1]}
                      </span>
                    </div>
                    <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{phase.subtitle}</span>
                  </div>

                  {idx < LIFECYCLE_MAP.length - 1 && (
                    <ArrowRight size={10} color="var(--border-default)" style={{ flexShrink: 0 }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Active Phase Detail Explorer ────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 320px',
            gap: 20,
            marginBottom: 20,
          }}
          className="cmd-grid-resources"
        >
          {/* Main Phase Principles & Guarantees */}
          <DataPanel
            title={currentPhase.title}
            subtitle={currentPhase.subtitle}
            icon={currentPhase.icon}
            badge={<VerifiedBadge />}
            actions={
              <Link to={currentPhase.route}>
                <ActionButton variant="cyan" size="sm" icon={ArrowRight}>
                  {currentPhase.routeLabel}
                </ActionButton>
              </Link>
            }
          >
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ARCHITECTURAL GUARANTEES & INVARIANTS
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {currentPhase.principles.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-xs)',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      fontSize: 13,
                      color: 'var(--text-primary)',
                      lineHeight: 1.5,
                    }}
                  >
                    <CheckCircle2 size={16} color={currentPhase.color} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </DataPanel>

          {/* Core Philosophy Callouts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <InsightCallout type="verified" title="Code Calculates. AI Explains.">
              NEXUS maintains a strict separation of powers: deterministic code executes all business calculations; generative models synthesize explanations without fabricating metrics.
            </InsightCallout>

            <InsightCallout type="info" title="Tenant Isolation By Contract">
              Authentication token validation enforces tenant isolation at the service boundary. Cross-tenant reads and mutations return 404 or 403.
            </InsightCallout>

            <InsightCallout type="action" title="Deterministic Action Logging">
              Every acknowledged risk, inventory change, and transaction is immutably recorded in the SQLite audit log with user email attribution.
            </InsightCallout>
          </div>
        </div>
      </div>
    </>
  )
}
