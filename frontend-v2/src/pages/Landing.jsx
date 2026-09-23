import { Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import {
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Package,
  Receipt,
  MessageSquareText,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
  Database,
  CheckCircle2,
  Zap,
  Lock,
} from 'lucide-react'
import IntelligencePipeline from '../components/IntelligencePipeline.jsx'

const MOCK_PREVIEW_AREA = [
  { day: 'Mon', val: 3200 },
  { day: 'Tue', val: 4100 },
  { day: 'Wed', val: 3800 },
  { day: 'Thu', val: 5200 },
  { day: 'Fri', val: 4900 },
  { day: 'Sat', val: 6800 },
  { day: 'Sun', val: 7400 },
]

const MOCK_PREVIEW_DONUT = [
  { name: 'Healthy', value: 68, color: '#00e676' },
  { name: 'Low Stock', value: 18, color: '#f5a623' },
  { name: 'Stockout', value: 14, color: '#ff4d5e' },
]

const MOCK_PREVIEW_BARS = [
  { sku: 'P101', exposure: 420 },
  { sku: 'P102', exposure: 680 },
  { sku: 'P103', exposure: 310 },
  { sku: 'P104', exposure: 890 },
]

export default function Landing() {
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div style={{ background: 'var(--bg-void)', color: 'var(--text-primary)', minHeight: '100vh', position: 'relative' }}>

      {/* ── 1. CINEMATIC NAVBAR ────────────────────────────────────────── */}
      <header
        style={{
          height: 70,
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 40px',
          position: 'sticky',
          top: 0,
          background: 'rgba(7, 9, 14, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          zIndex: 50,
        }}
      >
        <Link to="/landing" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 20V4l16 16V4"
              stroke="#4f75ff"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.15em', color: '#fff' }}>
            NEXUS
          </span>
          <span className="sidebar-badge-planned" style={{ fontSize: 10 }}>v2.0</span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <button
            type="button"
            onClick={() => scrollTo('architecture')}
            style={{ fontSize: 13, color: 'var(--text-secondary)', transition: 'color 0.15s ease' }}
          >
            System Topology
          </button>
          <button
            type="button"
            onClick={() => scrollTo('pillars')}
            style={{ fontSize: 13, color: 'var(--text-secondary)', transition: 'color 0.15s ease' }}
          >
            How NEXUS Thinks
          </button>
          <button
            type="button"
            onClick={() => scrollTo('workstation')}
            style={{ fontSize: 13, color: 'var(--text-secondary)', transition: 'color 0.15s ease' }}
          >
            Terminal Preview
          </button>
        </nav>

        <Link
          to="/"
          className="btn-command-action primary"
          style={{ padding: '8px 18px', fontSize: 13 }}
        >
          <span>Launch Command Center</span>
          <ArrowRight size={14} />
        </Link>
      </header>

      {/* ── 2. HERO SECTION ────────────────────────────────────────────── */}
      <section
        style={{
          padding: '80px 24px 60px',
          maxWidth: 1200,
          margin: '0 auto',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 14px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(79, 117, 255, 0.1)',
            border: '1px solid rgba(79, 117, 255, 0.3)',
            marginBottom: 24,
          }}
        >
          <Sparkles size={13} color="var(--brand-light)" />
          <span className="mono" style={{ fontSize: 11, color: 'var(--brand-light)', letterSpacing: '0.08em', fontWeight: 600 }}>
            AI BUSINESS INTELLIGENCE OPERATING ENVIRONMENT
          </span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(36px, 6vw, 64px)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            color: '#fff',
            marginBottom: 20,
            textShadow: '0 0 50px rgba(79, 117, 255, 0.2)',
          }}
        >
          SEE THE BUSINESS<br />
          <span style={{ color: 'var(--brand-light)' }}>BEHIND THE NUMBERS.</span>
        </h1>

        <p
          style={{
            fontSize: 'clamp(15px, 2vw, 19px)',
            color: 'var(--text-secondary)',
            maxWidth: 760,
            margin: '0 auto 36px',
            lineHeight: 1.6,
          }}
        >
          Financial intelligence terminal × enterprise control center × AI investigation workspace.
          Deterministic mathematical calculations paired with grounded natural language reasoning.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Link
            to="/"
            className="btn-command-action primary"
            style={{ padding: '12px 28px', fontSize: 14 }}
          >
            <span>Enter Command Center</span>
            <ArrowRight size={16} />
          </Link>
          <button
            type="button"
            onClick={() => scrollTo('architecture')}
            className="btn-command-action secondary"
            style={{ padding: '12px 24px', fontSize: 14 }}
          >
            <span>Inspect Architecture</span>
          </button>
        </div>
      </section>

      {/* ── 3. LIVE-LOOKING WORKSTATION PREVIEW ────────────────────────── */}
      <section
        id="workstation"
        style={{
          maxWidth: 1320,
          margin: '0 auto 100px',
          padding: '0 24px',
        }}
      >
        <div
          style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
          }}
        >
          {/* Mock Window Title Bar */}
          <div
            style={{
              padding: '12px 20px',
              background: 'var(--bg-env)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 12 }}>
                NEXUS / LIVE WORKSTATION TERMINAL
              </span>
            </div>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--brand-light)' }}>
              ILLUSTRATIVE SIMULATION · NON-PROD PREVIEW
            </div>
          </div>

          {/* Mock Body */}
          <div style={{ padding: '28px 32px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 16,
                marginBottom: 24,
              }}
            >
              <div style={{ padding: 18, background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Gross Sales Revenue</span>
                <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: '4px 0' }}>$142,850.00</div>
                <span style={{ fontSize: 11, color: 'var(--resolved-light)' }}>+14.2% demand velocity</span>
              </div>
              <div style={{ padding: 18, background: 'rgba(255,77,94,0.04)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,77,94,0.2)' }}>
                <span style={{ fontSize: 11, color: 'var(--risk-light)', textTransform: 'uppercase' }}>Daily Revenue Exposure</span>
                <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: 'var(--risk-light)', margin: '4px 0' }}>$1,840.00/d</div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>5 SKUs at stockout risk</span>
              </div>
              <div style={{ padding: 18, background: 'rgba(245,166,35,0.04)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(245,166,35,0.2)' }}>
                <span style={{ fontSize: 11, color: 'var(--ack-light)', textTransform: 'uppercase' }}>Trapped Capital</span>
                <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ack-light)', margin: '4px 0' }}>$38,200.00</div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>12 stagnant catalog SKUs</span>
              </div>
            </div>

            {/* Illustrative Multi-Chart Visual Showcase */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
              {/* Mini Area Chart */}
              <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>Revenue Velocity Trajectory</span>
                  <span className="mono" style={{ fontSize: 9.5, color: 'var(--brand-light)' }}>ILLUSTRATIVE</span>
                </div>
                <div style={{ height: 110 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={MOCK_PREVIEW_AREA} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="previewGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f75ff" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#4f75ff" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="val" stroke="#4f75ff" strokeWidth={2} fill="url(#previewGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Mini Donut Chart */}
              <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>Inventory Allocation</span>
                  <span className="mono" style={{ fontSize: 9.5, color: 'var(--brand-light)' }}>ILLUSTRATIVE</span>
                </div>
                <div style={{ height: 110, position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={MOCK_PREVIEW_DONUT} innerRadius={28} outerRadius={42} paddingAngle={3} dataKey="value">
                        {MOCK_PREVIEW_DONUT.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>100%</span>
                  </div>
                </div>
              </div>

              {/* Mini Bar Chart */}
              <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>SKU Exposure Impact</span>
                  <span className="mono" style={{ fontSize: 9.5, color: 'var(--brand-light)' }}>ILLUSTRATIVE</span>
                </div>
                <div style={{ height: 110 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={MOCK_PREVIEW_BARS} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <Bar dataKey="exposure" fill="#ff4d5e" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Mock Reasoning Stage Preview */}
            <div
              style={{
                padding: '20px 24px',
                background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.05) 0%, rgba(79, 117, 255, 0.05) 100%)',
                border: '1px solid rgba(167, 139, 250, 0.25)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Sparkles size={14} color="var(--purple)" />
                <span className="mono" style={{ fontSize: 11, color: 'var(--purple)', fontWeight: 700, letterSpacing: '0.06em' }}>
                  GROUNDED AI REASONING DEMONSTRATION
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                “SKU <strong>#AC-9042</strong> is accelerating at <strong>4.8 units/day</strong> against an on-hand inventory of <strong>6 units</strong>. Stockout is deterministically projected within <strong>31 hours</strong>, creating a daily revenue exposure of <strong>$412.80</strong>. Safety stock reorder of 40 units is recommended immediately.”
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* ── 4. HOW NEXUS THINKS ────────────────────────────────────────── */}
      <section
        id="pillars"
        style={{
          maxWidth: 1200,
          margin: '0 auto 100px',
          padding: '0 24px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--brand-light)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Core Architectural Principles
          </span>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#fff', marginTop: 6 }}>
            Code Calculates. AI Explains.
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 640, margin: '10px auto 0' }}>
            NEXUS strictly rejects hallucinated business math. Analytical algorithms execute in pure deterministic code; generative AI provides contextual explanation.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          <div className="card" style={{ padding: 28 }}>
            <Cpu size={24} color="var(--brand)" style={{ marginBottom: 16 }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
              1. Deterministic Calculation
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              All inventory levels, depletion rates, revenue figures, and priority ranks are computed mathematically. Zero AI estimation in the calculation path.
            </p>
          </div>

          <div className="card" style={{ padding: 28 }}>
            <ShieldCheck size={24} color="var(--resolved)" style={{ marginBottom: 16 }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
              2. Verified Fact Grounding
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              When AI generates an executive explanation, it cites verified numbers directly from SQL results, complete with calibrated confidence tags.
            </p>
          </div>

          <div className="card" style={{ padding: 28 }}>
            <Layers size={24} color="var(--purple)" style={{ marginBottom: 16 }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
              3. Operational Actionability
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              From situational awareness to immediate lifecycle transitions: acknowledge risks, record audit memoranda, and resolve stockout threats in one click.
            </p>
          </div>
        </div>
      </section>

      {/* ── 5. SYSTEM TOPOLOGY ────────────────────────────────────────── */}
      <section
        id="architecture"
        style={{
          maxWidth: 1200,
          margin: '0 auto 100px',
          padding: '0 24px',
        }}
      >
        <IntelligencePipeline />
      </section>

      {/* ── 6. FOOTER ─────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '40px 40px',
          background: 'var(--bg-env)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.1em', color: '#fff' }}>
            NEXUS
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            · AI Business Intelligence Operating Environment
          </span>
        </div>

        <div style={{ display: 'flex', gap: 20, fontSize: 12.5, color: 'var(--text-secondary)' }}>
          <Link to="/" style={{ color: 'var(--brand-light)' }}>Command Center</Link>
          <Link to="/risk-queue">Risk Queue</Link>
          <Link to="/financial">Financial</Link>
          <Link to="/inventory">Inventory</Link>
          <Link to="/investigations">Investigations</Link>
        </div>
      </footer>

    </div>
  )
}
