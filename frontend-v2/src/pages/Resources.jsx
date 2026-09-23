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
  ExternalLink,
  BookOpen,
  FileCheck,
} from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import IntelligencePipeline from '../components/IntelligencePipeline.jsx'

const RESOURCE_DOMAINS = [
  {
    domain: 'BUSINESS DATA',
    tag: 'Authoritative Sources',
    color: 'var(--cyan)',
    resources: [
      {
        id: 'res-products',
        title: 'Product Master Catalog',
        description: 'Authoritative catalog of active SKUs, product naming, and base pricing.',
        source: 'SQLite: products table · Tenant-scoped',
        destination: '/inventory',
        actionText: 'View catalog in Inventory',
        icon: Package,
      },
      {
        id: 'res-inventory',
        title: 'Inventory Stock Levels',
        description: 'Verified physical inventory on hand and safety stock reorder thresholds.',
        source: 'SQLite: inventory table · GET /api/v1/inventory',
        destination: '/inventory',
        actionText: 'Inspect Inventory Stock',
        icon: Database,
      },
      {
        id: 'res-transactions',
        title: 'POS Transaction Stream',
        description: 'Immutable transaction records capturing units sold, order dates, and total amount.',
        source: 'SQLite: transactions table · GET /api/v1/transactions',
        destination: '/transactions',
        actionText: 'Audit POS Transactions',
        icon: Receipt,
      },
      {
        id: 'res-financial-data',
        title: 'Retail Asset Valuations',
        description: 'Calculations of on-hand retail inventory valuation and capital trapped in stagnant SKUs.',
        source: 'GET /api/v1/financial/summary',
        destination: '/financial',
        actionText: 'Inspect Financial Exposure',
        icon: TrendingUp,
      },
    ],
  },
  {
    domain: 'INTELLIGENCE ENGINES',
    tag: 'Deterministic Math',
    color: 'var(--brand)',
    resources: [
      {
        id: 'res-risk-correlation',
        title: 'Cross-Domain Prioritization',
        description: 'Evaluates multi-domain collisions between stock depletion rates, demand spikes, and capital.',
        source: 'AnalyticsService · GET /api/v1/cross-domain/priorities',
        destination: '/risk-queue',
        actionText: 'Launch Risk Queue',
        icon: AlertTriangle,
      },
      {
        id: 'res-ai-investigations',
        title: 'Grounded AI Investigations',
        description: 'Contextual AI explanation engine citing answers strictly against verified SQL facts.',
        source: 'InvestigationService · POST /api/v1/investigations',
        destination: '/investigations',
        actionText: 'Open AI Console',
        icon: MessageSquareText,
      },
      {
        id: 'res-demand-trends',
        title: 'Velocity Comparison Engine',
        description: '14-day velocity comparison determining acceleration, deceleration, and demand shift.',
        source: 'AnalyticsService · GET /api/v1/analytics/trends',
        destination: '/',
        actionText: 'View in Command Center',
        icon: TrendingUp,
      },
    ],
  },
  {
    domain: 'OPERATIONS & AUDIT',
    tag: 'State Reconciliation',
    color: 'var(--resolved)',
    resources: [
      {
        id: 'res-risk-actions',
        title: 'Action Lifecycle Log',
        description: 'Audit log of user acknowledgements, resolutions, dismissals, and audit notes.',
        source: 'SQLite: risk_actions table',
        destination: '/activity',
        actionText: 'Open Audit Stream',
        icon: History,
      },
      {
        id: 'res-saved-investigations',
        title: 'Investigation Archive',
        description: 'Persistent audit library of past natural language inquiries and calibrated confidence.',
        source: 'GET /api/v1/investigations',
        destination: '/saved-investigations',
        actionText: 'View Saved Inquiries',
        icon: BookOpen,
      },
    ],
  },
  {
    domain: 'ARCHITECTURE & RULES',
    tag: 'Core Tenets',
    color: 'var(--purple)',
    resources: [
      {
        id: 'res-rule-code-ai',
        title: 'Code Calculates. AI Explains.',
        description: 'Foundational architectural separation: zero synthetic business math by generative models.',
        source: 'System Architecture Specification',
        destination: '/landing',
        actionText: 'Read Architectural Guarantees',
        icon: ShieldCheck,
      },
      {
        id: 'res-rule-tenant',
        title: 'JWT Tenant Isolation',
        description: 'Row-level multi-tenant security strictly derived from verified JWT authentication claims.',
        source: 'Auth & RBAC Middleware',
        destination: '/',
        actionText: 'Command Center Security',
        icon: FileCheck,
      },
    ],
  },
]

export default function Resources({ onToggleMobileMenu }) {
  const [activeDomain, setActiveDomain] = useState('ALL')

  const displayedDomains = activeDomain === 'ALL'
    ? RESOURCE_DOMAINS
    : RESOURCE_DOMAINS.filter((d) => d.domain === activeDomain)

  return (
    <>
      <Topbar
        title="INTELLIGENCE MAP & TOPOLOGY"
        subtitle="System understanding of data sources, analytical engines, and operational rules."
        onToggleMobileMenu={onToggleMobileMenu}
      />

      <div className="page-content">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="command-header">
          <div className="command-header-left">
            <div className="command-header-meta">
              <span className="mono" style={{ fontSize: 11, color: 'var(--cyan)', fontWeight: 600 }}>
                SYSTEM UNDERSTANDING
              </span>
              <span className="command-status-badge">
                <span className="status-dot-pulse" />
                TOPOLOGY RECONCILED
              </span>
            </div>
            <h1 className="command-header-title">Intelligence Map & Topology</h1>
            <p className="command-header-desc">
              Comprehensive architectural blueprint linking raw business data sources to deterministic calculation engines and AI synthesis.
            </p>
          </div>
        </div>

        {/* ── Architecture Pipeline Visual ────────────────────────────── */}
        <IntelligencePipeline />

        {/* ── Domain Filter Tabs ──────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveDomain('ALL')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-xs)',
              fontSize: 12.5,
              fontWeight: 600,
              background: activeDomain === 'ALL' ? 'var(--brand)' : 'rgba(255, 255, 255, 0.03)',
              color: activeDomain === 'ALL' ? '#fff' : 'var(--text-secondary)',
              border: '1px solid',
              borderColor: activeDomain === 'ALL' ? 'var(--brand)' : 'var(--border-subtle)',
            }}
          >
            All Domains
          </button>
          {RESOURCE_DOMAINS.map((d) => (
            <button
              key={d.domain}
              type="button"
              onClick={() => setActiveDomain(d.domain)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-xs)',
                fontSize: 12.5,
                fontWeight: 600,
                background: activeDomain === d.domain ? d.color : 'rgba(255, 255, 255, 0.03)',
                color: activeDomain === d.domain ? '#000' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: activeDomain === d.domain ? d.color : 'var(--border-subtle)',
              }}
            >
              {d.domain}
            </button>
          ))}
        </div>

        {/* ── Resource Cards by Domain ────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {displayedDomains.map((domainBlock) => (
            <div key={domainBlock.domain}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: domainBlock.color }} />
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>
                  {domainBlock.domain}
                </h2>
                <span className="mono" style={{ fontSize: 10.5, color: domainBlock.color, textTransform: 'uppercase' }}>
                  [{domainBlock.tag}]
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 16,
                }}
              >
                {domainBlock.resources.map((item) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={item.id}
                      className="card"
                      style={{
                        padding: '18px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <Icon size={16} color={domainBlock.color} />
                          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                            {item.title}
                          </h3>
                        </div>
                        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
                          {item.description}
                        </p>
                      </div>

                      <div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                          {item.source}
                        </div>
                        <Link
                          to={item.destination}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--brand-light)',
                          }}
                        >
                          <span>{item.actionText}</span>
                          <ArrowRight size={13} />
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

      </div>
    </>
  )
}
