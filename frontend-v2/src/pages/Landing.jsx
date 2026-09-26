import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Cpu,
  Zap,
  AlertTriangle,
  TrendingUp,
  Receipt,
  Package,
  Coins,
  CheckCircle2,
  Database,
  Search,
  BookOpen,
  Smartphone,
  Activity,
  Layers,
  ChevronRight,
  Lock,
  GitBranch,
  Terminal,
  FileCode,
  Radio,
  Sliders,
  Check,
  Plus,
  RefreshCw,
} from 'lucide-react'
import IntelligencePipeline from '../components/IntelligencePipeline.jsx'
import CustomChartTooltip from '../components/CustomChartTooltip.jsx'
import VerifiedBadge from '../components/primitives/VerifiedBadge.jsx'
import IntelligenceBadge from '../components/primitives/IntelligenceBadge.jsx'
import TechnicalLabel from '../components/primitives/TechnicalLabel.jsx'
import { useI18n } from '../i18n/index.jsx'

const ILLUSTRATIVE_AREA = [
  { day: 'Mon', val: 3200, prior: 2800 },
  { day: 'Tue', val: 4100, prior: 3100 },
  { day: 'Wed', val: 3800, prior: 3500 },
  { day: 'Thu', val: 5200, prior: 4000 },
  { day: 'Fri', val: 4900, prior: 4200 },
  { day: 'Sat', val: 6800, prior: 5100 },
  { day: 'Sun', val: 7400, prior: 5800 },
]

function MiniWaveSparkline({ points, stroke, width = 76, height = 22 }) {
  if (!points || points.length === 0) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (width - 8) + 4
    const y = height - 4 - ((p - min) / range) * (height - 8)
    return { x, y }
  })
  const d = coords.reduce((acc, curr, i, arr) => {
    if (i === 0) return `M ${curr.x} ${curr.y}`
    const prev = arr[i - 1]
    const cx = (prev.x + curr.x) / 2
    return `${acc} C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`
  }, '')
  const lastPoint = coords[coords.length - 1]

  return (
    <svg className="render-spark-svg" viewBox={`0 0 ${width} ${height}`}>
      <path d={d} stroke={stroke} fill="none" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx={lastPoint.x} cy={lastPoint.y} r="2.6" fill={stroke} className="render-spark-dot" />
    </svg>
  )
}

function TelemetryOscilloscope({ srv }) {
  const data = srv.data || []
  const maxVal = Math.max(...data.map((d) => d.val), 1)
  const width = 480
  const height = 110

  const coords = data.map((d, i) => ({
    x: (i / (data.length - 1)) * (width - 24) + 12,
    y: height - 12 - (d.val / maxVal) * (height - 28),
    priorY: height - 12 - ((d.prior || d.val * 0.8) / maxVal) * (height - 28),
  }))

  const splineD = coords.reduce((acc, curr, i, arr) => {
    if (i === 0) return `M ${curr.x} ${curr.y}`
    const prev = arr[i - 1]
    const cx = (prev.x + curr.x) / 2
    return `${acc} C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`
  }, '')

  const priorD = coords.reduce((acc, curr, i, arr) => {
    if (i === 0) return `M ${curr.x} ${curr.priorY}`
    const prev = arr[i - 1]
    const cx = (prev.x + curr.x) / 2
    return `${acc} C ${cx} ${prev.priorY}, ${cx} ${curr.priorY}, ${curr.x} ${curr.priorY}`
  }, '')

  const areaD = `${splineD} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`
  const last = coords[coords.length - 1]

  return (
    <div className="render-oscilloscope-wrap" style={{ marginTop: 12 }}>
      <div
        className="render-scanline-laser"
        style={{
          background: `linear-gradient(180deg, transparent, ${srv.stroke}, transparent)`,
          boxShadow: `0 0 10px ${srv.stroke}`,
        }}
      />
      <svg className="render-oscilloscope-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${srv.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={srv.stroke} stopOpacity="0.45" />
            <stop offset="100%" stopColor={srv.stroke} stopOpacity="0.0" />
          </linearGradient>
          <filter id={`glow-${srv.id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <line x1="0" y1="28" x2={width} y2="28" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
        <line x1="0" y1="62" x2={width} y2="62" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
        <line x1="0" y1="96" x2={width} y2="96" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />

        <path d={priorD} fill="none" stroke="#475569" strokeWidth="1.4" strokeDasharray="4 4" />
        <path d={areaD} fill={`url(#grad-${srv.id})`} />
        <path
          d={splineD}
          fill="none"
          stroke={srv.stroke}
          strokeWidth="2.4"
          strokeLinecap="round"
          filter={`url(#glow-${srv.id})`}
        />

        <circle cx={last.x} cy={last.y} r="4.5" fill={srv.stroke} className="render-spark-dot" />
        <circle
          cx={last.x}
          cy={last.y}
          r="9"
          fill="none"
          stroke={srv.stroke}
          strokeWidth="1.2"
          opacity="0.6"
          className="render-spark-dot"
        />
      </svg>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: 8,
          marginTop: 4,
          fontSize: 11,
        }}
        className="mono"
      >
        <span style={{ color: '#94a3b8' }}>{srv.stat1}</span>
        <span style={{ color: srv.stroke, fontWeight: 700 }}>● {srv.stat2}</span>
      </div>
    </div>
  )
}

const COCKPIT_SERVICES = {
  pos: {
    id: 'pos',
    name: 'pos-stream',
    status: '✓ Available',
    statusClass: '',
    stroke: '#a855f7',
    spark1: { label: 'INGEST', val: '1,420/s', points: [12, 18, 14, 22, 26, 21, 29, 32] },
    spark2: { label: 'LATENCY', val: '0.18ms', points: [7, 5, 8, 4, 6, 5, 3, 4] },
    metric: '₹3,42,850',
    subText: '+14.2% vel',
    stat1: '1,420 Txns/day',
    stat2: '0.18ms Ingest Latency',
    data: ILLUSTRATIVE_AREA,
  },
  inventory: {
    id: 'inventory',
    name: 'inventory-ledger',
    status: '✓ Available',
    statusClass: '',
    stroke: '#38bdf8',
    spark1: { label: 'ACTIVE SKUS', val: '24 SKUs', points: [24, 24, 24, 24, 24, 24, 24, 24] },
    spark2: { label: 'VELOCITY', val: '+14.2%', points: [12, 15, 17, 19, 21, 23, 24, 28] },
    metric: '4,912',
    subText: 'units active',
    stat1: '24 Active SKUs',
    stat2: 'Zero Orphan Rows',
    data: [
      { day: 'Mon', val: 4800, prior: 4900 },
      { day: 'Tue', val: 4750, prior: 4850 },
      { day: 'Wed', val: 4600, prior: 4780 },
      { day: 'Thu', val: 4900, prior: 4700 },
      { day: 'Fri', val: 4820, prior: 4650 },
      { day: 'Sat', val: 5050, prior: 4800 },
      { day: 'Sun', val: 4912, prior: 4900 },
    ],
  },
  risk: {
    id: 'risk',
    name: 'risk-engine',
    status: '● 2 Risks',
    statusClass: 'critical',
    stroke: '#fb7185',
    spark1: { label: 'THREAT', val: 'SKU P104', points: [6, 12, 18, 26, 32, 40, 48, 54] },
    spark2: { label: 'BUFFER', val: '31h left', points: [48, 44, 38, 30, 24, 18, 12, 6] },
    metric: 'SKU P104',
    subText: '31h to stockout',
    stat1: 'Priority 1 Stockout (₹34,250)',
    stat2: 'Zero Synthetic Noise',
    data: [
      { day: 'Mon', val: 1200, prior: 4000 },
      { day: 'Tue', val: 2400, prior: 3200 },
      { day: 'Wed', val: 4800, prior: 2900 },
      { day: 'Thu', val: 14000, prior: 2500 },
      { day: 'Fri', val: 22000, prior: 2100 },
      { day: 'Sat', val: 28500, prior: 1800 },
      { day: 'Sun', val: 34250, prior: 1500 },
    ],
  },
  audit: {
    id: 'audit',
    name: 'sqlite-wal',
    status: '✓ Available',
    statusClass: '',
    stroke: '#34d399',
    spark1: { label: 'COMMITS', val: '4,890/h', points: [15, 20, 24, 28, 32, 35, 38, 42] },
    spark2: { label: 'DRIFT', val: '0.00%', points: [2, 2, 2, 2, 2, 2, 2, 2] },
    metric: 'SQLite WAL',
    subText: '100% verified',
    stat1: 'Append-Only Ledger',
    stat2: 'ACID Strict Durability',
    data: [
      { day: 'Mon', val: 140, prior: 120 },
      { day: 'Tue', val: 210, prior: 180 },
      { day: 'Wed', val: 180, prior: 160 },
      { day: 'Thu', val: 290, prior: 240 },
      { day: 'Fri', val: 310, prior: 280 },
      { day: 'Sat', val: 360, prior: 320 },
      { day: 'Sun', val: 390, prior: 340 },
    ],
  },
}

const INITIAL_LOGS = [
  { id: 1, time: '19:12:04', tag: 'sale', text: '-3 units SKU #P104 recorded (Balance: 11)' },
  { id: 2, time: '19:12:05', tag: 'risk', text: 'Safety buffer breached: Stockout projected in 31h' },
  { id: 3, time: '19:12:06', tag: 'triage', text: 'Operator acknowledged reorder recommendation' },
  { id: 4, time: '19:12:07', tag: 'audit', text: 'Permanent SQLite transaction committed by Actor #1' },
]

export default function Landing() {
  const { t, lang, setLang } = useI18n()
  const [activeTrailId, setActiveTrailId] = useState('risk')
  const [activeDepthLevel, setActiveDepthLevel] = useState(0)

  // Dynamic interactive Render-grade states
  const [activeCockpitService, setActiveCockpitService] = useState('pos')
  const [activePipelineStep, setActivePipelineStep] = useState(1)
  const [activePreviewPr, setActivePreviewPr] = useState('108')
  const [step1Stream, setStep1Stream] = useState('pos')
  const [calcVelocity, setCalcVelocity] = useState(12)
  const [activeCodeTab, setActiveCodeTab] = useState('python')
  const [step3View, setStep3View] = useState('summary')
  const [logEvents, setLogEvents] = useState(INITIAL_LOGS)

  // Live auto-streaming telemetry simulation (Render benchmark)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      const timeStr = now.toTimeString().split(' ')[0]
      const skus = ['P104', 'P102', 'P108', 'P112']
      const sku = skus[Math.floor(Math.random() * skus.length)]
      const qty = Math.floor(Math.random() * 3) + 1
      const streamTypes = [
        { tag: 'sale', text: `-${qty} units SKU #${sku} recorded via POS stream` },
        { tag: 'triage', text: `Telemetry verified: Stock buffer healthy for SKU #${sku}` },
        { tag: 'risk', text: `Depletion rate adjusted for SKU #${sku} (Run-rate: 14.8/d)` },
      ]
      const chosen = streamTypes[Math.floor(Math.random() * streamTypes.length)]
      setLogEvents((prev) => [
        { id: Date.now(), time: timeStr, tag: chosen.tag, text: chosen.text, isNew: true },
        ...prev.slice(0, 4),
      ])
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  const handleSimulateSale = () => {
    const now = new Date()
    const timeStr = now.toTimeString().split(' ')[0]
    const randomQty = Math.floor(Math.random() * 4) + 1
    const newLog = {
      id: Date.now(),
      time: timeStr,
      tag: 'sale',
      text: `-${randomQty} units SKU #P104 recorded via POS stream`,
    }
    setLogEvents((prev) => [newLog, ...prev.slice(0, 5)])
  }

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  // 7 nodes of the central NEXUS trail
  const trailNodes = [
    {
      id: 'data',
      num: '01',
      title: t('landing.trailNodeData'),
      sub: t('landing.trailNodeDataSub'),
      detail: t('landing.trailNodeDataDetail'),
      icon: Database,
      badge: 'AUTHORITATIVE',
      color: 'var(--cyan)',
    },
    {
      id: 'intel',
      num: '02',
      title: t('landing.trailNodeIntel'),
      sub: t('landing.trailNodeIntelSub'),
      detail: t('landing.trailNodeIntelDetail'),
      icon: Activity,
      badge: 'CORRELATION',
      color: 'var(--brand)',
    },
    {
      id: 'risk',
      num: '03',
      title: t('landing.trailNodeRisk'),
      sub: t('landing.trailNodeRiskSub'),
      detail: t('landing.trailNodeRiskDetail'),
      icon: AlertTriangle,
      badge: 'DETERMINISTIC',
      color: 'var(--risk)',
    },
    {
      id: 'impact',
      num: '04',
      title: t('landing.trailNodeImpact'),
      sub: t('landing.trailNodeImpactSub'),
      detail: t('landing.trailNodeImpactDetail'),
      icon: Coins,
      badge: 'FINANCIAL',
      color: 'var(--warning)',
    },
    {
      id: 'investigate',
      num: '05',
      title: t('landing.trailNodeInvestigate'),
      sub: t('landing.trailNodeInvestigateSub'),
      detail: t('landing.trailNodeInvestigateDetail'),
      icon: Search,
      badge: 'GROUNDED AI',
      color: 'var(--purple)',
    },
    {
      id: 'action',
      num: '06',
      title: t('landing.trailNodeAction'),
      sub: t('landing.trailNodeActionSub'),
      detail: t('landing.trailNodeActionDetail'),
      icon: CheckCircle2,
      badge: 'TRIAGE',
      color: 'var(--brand-light)',
    },
    {
      id: 'audit',
      num: '07',
      title: t('landing.trailNodeAudit'),
      sub: t('landing.trailNodeAuditSub'),
      detail: t('landing.trailNodeAuditDetail'),
      icon: ShieldCheck,
      badge: 'IMMUTABLE',
      color: 'var(--resolved)',
    },
  ]

  const activeTrailNode = trailNodes.find((n) => n.id === activeTrailId) || trailNodes[2]

  // 5 levels of progressive disclosure
  const depthLevels = [
    {
      tag: t('landing.depthLevel1Tag'),
      title: t('landing.depthLevel1Title'),
      summary: t('landing.depthLevel1Summary'),
      example: t('landing.depthLevel1Example'),
      icon: AlertTriangle,
      badge: 'SURFACE',
    },
    {
      tag: t('landing.depthLevel2Tag'),
      title: t('landing.depthLevel2Title'),
      summary: t('landing.depthLevel2Summary'),
      example: t('landing.depthLevel2Example'),
      icon: TrendingUp,
      badge: 'CONTEXT',
    },
    {
      tag: t('landing.depthLevel3Tag'),
      title: t('landing.depthLevel3Title'),
      summary: t('landing.depthLevel3Summary'),
      example: t('landing.depthLevel3Example'),
      icon: Database,
      badge: 'EVIDENCE',
    },
    {
      tag: t('landing.depthLevel4Tag'),
      title: t('landing.depthLevel4Title'),
      summary: t('landing.depthLevel4Summary'),
      example: t('landing.depthLevel4Example'),
      icon: Coins,
      badge: 'EXPOSURE',
    },
    {
      tag: t('landing.depthLevel5Tag'),
      title: t('landing.depthLevel5Title'),
      summary: t('landing.depthLevel5Summary'),
      example: t('landing.depthLevel5Example'),
      icon: ShieldCheck,
      badge: 'AUDIT LOG',
    },
  ]

  const activeLevel = depthLevels[activeDepthLevel] || depthLevels[0]

  return (
    <div style={{ background: '#050608', color: '#ffffff', minHeight: '100vh', position: 'relative', overflowX: 'hidden' }}>

      {/* Dynamic Ambient Background & Radiant Lights */}
      <div className="render-ambient-grid" />
      <div className="render-ambient-glow-purple" />
      <div className="render-ambient-glow-cyan" />

      {/* ── TOP ANNOUNCEMENT BANNER (RENDER BENCHMARK) ────────────────── */}
      <div className="render-top-banner">
        <span>NEXUS V2.0 · Live Retail & Inventory Operational Intelligence Environment</span>
        <span style={{ opacity: 0.4 }}>|</span>
        <Link to="/" className="render-top-banner-link">
          Launch Workstation →
        </Link>
      </div>

      {/* ── CINEMATIC NAVBAR ───────────────────────────────────────────── */}
      <header
        style={{
          height: 68,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 clamp(16px, 4vw, 40px)',
          position: 'sticky',
          top: 0,
          background: 'rgba(5, 6, 8, 0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          zIndex: 50,
        }}
      >
        <Link to="/landing" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 20V4l16 16V4"
              stroke="#3b82f6"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.12em', color: '#fff' }}>
            NEXUS
          </span>
          <TechnicalLabel value="V2.0" variant="cyan" size="xs" />
        </Link>

        <nav
          style={{ display: 'flex', alignItems: 'center', gap: 24 }}
          className="desktop-table-view"
          aria-label="Landing page sections"
        >
          <button
            type="button"
            onClick={() => scrollTo('problem')}
            style={{ fontSize: 13, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {t('landing.navProblem')}
          </button>
          <button
            type="button"
            onClick={() => scrollTo('workflow')}
            style={{ fontSize: 13, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Workflow
          </button>
          <button
            type="button"
            onClick={() => scrollTo('trail')}
            style={{ fontSize: 13, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {t('landing.navTrail')}
          </button>
          <button
            type="button"
            onClick={() => scrollTo('features')}
            style={{ fontSize: 13, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Features
          </button>
          <button
            type="button"
            onClick={() => scrollTo('philosophy')}
            style={{ fontSize: 13, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {t('landing.navPrinciple')}
          </button>
          <button
            type="button"
            onClick={() => scrollTo('topology')}
            style={{ fontSize: 13, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {t('landing.navTopology')}
          </button>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Bilingual EN / HI Language Switcher */}
          <div className="topbar-lang-toggle" role="group" aria-label="Language selection">
            <button
              type="button"
              className={`topbar-lang-btn ${lang === 'en' ? 'active' : ''}`}
              onClick={() => setLang('en')}
              aria-pressed={lang === 'en'}
              aria-label="Switch to English"
            >
              EN
            </button>
            <span className="topbar-lang-divider" aria-hidden="true" />
            <button
              type="button"
              className={`topbar-lang-btn ${lang === 'hi' ? 'active' : ''}`}
              onClick={() => setLang('hi')}
              aria-pressed={lang === 'hi'}
              aria-label="हिन्दी में बदलें"
            >
              HI
            </button>
          </div>

          <Link to="/">
            <button type="button" className="render-btn-white render-header-launch-btn">
              {t('landing.launchBtn')}
            </button>
          </Link>
        </div>
      </header>

      {/* ── 1. TWO-COLUMN RENDER HERO SECTION (RENDER SCREENSHOT 1) ────── */}
      <section id="problem" className="render-hero-section">
        {/* Left Column: Bold Typography & Action */}
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 20, background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.25)', marginBottom: 20 }}>
            <Sparkles size={13} color="#a855f7" />
            <span className="mono" style={{ fontSize: 11, color: '#c084fc', letterSpacing: '0.06em', fontWeight: 700 }}>
              {t('landing.problemEyebrow')}
            </span>
          </div>

          <h1 className="render-hero-headline">
            <span>{t('landing.problemHeadlineLine1')}</span>
            <br />
            <span className="render-hero-gradient">
              {t('landing.problemHeadlineLine2')}
            </span>
          </h1>

          <p className="render-hero-subtitle">
            {t('landing.problemPara1')} {t('landing.problemPara2')}
          </p>

          <div className="render-hero-ctas">
            <Link to="/">
              <button type="button" className="render-btn-white">
                <span>{t('landing.enterBtn')}</span>
                <ArrowRight size={15} />
              </button>
            </Link>
            <button
              type="button"
              className="render-btn-dark"
              onClick={() => scrollTo('workflow')}
            >
              <Terminal size={15} />
              <span>Inspect Workflow</span>
            </button>
          </div>

          <div style={{ fontSize: 11, color: '#64748b' }} className="mono">
            * Deterministic server-side math. Grounded AI explanations. Zero synthetic metrics.
          </div>
        </div>

        {/* Right Column: Interactive Live Workstation Cockpit Mockup */}
        <div>
          <div className="render-floating-cmd">
            <Terminal size={13} color="#a855f7" />
            <span>$ nexus telemetry --live --stream=pos</span>
          </div>

          <div className="render-cockpit">
            {/* Ambient Laser Scan Beam */}
            <div className="render-scan-beam" />

            <div className="render-cockpit-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="render-window-dots">
                  <span className="dot dot-red" />
                  <span className="dot dot-yellow" />
                  <span className="dot dot-green" />
                </div>
                <span className="mono" style={{ fontSize: 11, color: '#94a3b8' }}>
                  production/nexus-cockpit
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#10b981', fontWeight: 600 }}>
                <div className="status-dot-pulse-wrap">
                  <span className="status-dot-radar-ring" />
                  <span className="status-dot-pulse" style={{ width: 6, height: 6 }} />
                </div>
                <span className="mono">STREAMING</span>
              </div>
            </div>

            {/* 4 Live Service Status Cards (Render Benchmark: Dual Sparklines inside cards) */}
            <div className="render-services-grid" role="tablist" aria-label="Cockpit telemetry streams">
              {Object.values(COCKPIT_SERVICES).map((srv) => {
                const isActive = activeCockpitService === srv.id
                return (
                  <div
                    key={srv.id}
                    role="tab"
                    tabIndex={0}
                    aria-selected={isActive}
                    className={`render-service-card-v2 ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveCockpitService(srv.id)}
                    onKeyDown={(e) => e.key === 'Enter' && setActiveCockpitService(srv.id)}
                    style={{
                      '--active-stroke': srv.stroke,
                      borderColor: isActive ? srv.stroke : (srv.id === 'risk' ? 'rgba(244, 63, 94, 0.35)' : undefined),
                    }}
                  >
                    <div className="render-service-header">
                      <span className="render-service-name" style={{ color: isActive ? '#fff' : '#cbd5e1' }}>{srv.name}</span>
                      <span className={`render-service-status ${srv.statusClass}`}>{srv.status}</span>
                    </div>

                    {/* Dual SVG Sparklines inside card (Render Style) */}
                    <div className="render-card-spark-grid">
                      <div className="render-card-spark-col">
                        <div className="render-card-spark-label">
                          <span>{srv.spark1.label}</span>
                          <span className="render-card-spark-val mono">{srv.spark1.val}</span>
                        </div>
                        <MiniWaveSparkline points={srv.spark1.points} stroke={srv.stroke} />
                      </div>

                      <div className="render-card-spark-col">
                        <div className="render-card-spark-label">
                          <span>{srv.spark2.label}</span>
                          <span className="render-card-spark-val mono">{srv.spark2.val}</span>
                        </div>
                        <MiniWaveSparkline points={srv.spark2.points} stroke={srv.stroke} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Dynamic Living Oscilloscope Area Waveform with Laser Scan */}
            {(() => {
              const currentSrv = COCKPIT_SERVICES[activeCockpitService] || COCKPIT_SERVICES.pos
              return <TelemetryOscilloscope srv={currentSrv} />
            })()}
          </div>
        </div>
      </section>

      {/* ── 2. "CLICK, CLICK, DONE." 3-STEP PIPELINE (RENDER SCREENSHOT 2) */}
      <section id="workflow" className="render-pipeline-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span className="mono" style={{ fontSize: 11, color: '#c084fc', letterSpacing: '0.08em', fontWeight: 700 }}>
                RENDER-GRADE OPERATIONAL FLOW
              </span>
            </div>
            <h2 className="render-section-title-large" style={{ margin: 0 }}>
              Connect the trail in 3 deterministic steps.
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="mono" style={{ fontSize: 11, color: '#64748b' }}>Interactive Preview</span>
          </div>
        </div>

        <div className="render-steps-grid">
          {/* Step 1 */}
          <div
            className={`render-step-col ${activePipelineStep === 1 ? 'active' : ''}`}
            onClick={() => setActivePipelineStep(1)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="render-step-num-badge">1</div>
              <h3 className="render-step-title">Ingest the signals</h3>
            </div>
            <p className="render-step-desc">
              Connect POS receipts, SKU velocity, and warehouse balances without changing your existing operations.
            </p>

            <div className="render-step-mockup">
              <div className="render-interactive-pill-row">
                <button
                  type="button"
                  className={`render-interactive-pill-btn ${step1Stream === 'pos' ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setStep1Stream('pos') }}
                >
                  POS Stream
                </button>
                <button
                  type="button"
                  className={`render-interactive-pill-btn ${step1Stream === 'stock' ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setStep1Stream('stock') }}
                >
                  Stock On Hand
                </button>
                <button
                  type="button"
                  className={`render-interactive-pill-btn ${step1Stream === 'reorder' ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setStep1Stream('reorder') }}
                >
                  Safety Buffer
                </button>
              </div>

              {step1Stream === 'pos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 4, fontSize: 12, color: '#34d399' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Check size={14} /> POS Sales Stream
                    </span>
                    <span className="mono" style={{ fontSize: 10 }}>ACTIVE · 14.2/s</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: 4 }} className="mono">
                    EVENT: SALE · SKU: P104 · QTY: 3
                  </div>
                </div>
              )}

              {step1Stream === 'stock' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: 4, fontSize: 12, color: '#38bdf8' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Check size={14} /> Stock Ledger Sync
                    </span>
                    <span className="mono" style={{ fontSize: 10 }}>SYNCED</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: 4 }} className="mono">
                    BALANCE: 14 units · LEAD TIME: 7d
                  </div>
                </div>
              )}

              {step1Stream === 'reorder' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: 4, fontSize: 12, color: '#fb7185' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={14} /> Safety Threshold
                    </span>
                    <span className="mono" style={{ fontSize: 10 }}>BREACHED</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: 4 }} className="mono">
                    MIN: 30 units · ON HAND: 14 units
                  </div>
                </div>
              )}

              <div style={{ fontSize: 11, color: '#64748b', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, marginTop: 8 }} className="mono">
                Source: Authoritative SQLite DB
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div
            className={`render-step-col ${activePipelineStep === 2 ? 'active' : ''}`}
            onClick={() => setActivePipelineStep(2)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="render-step-num-badge">2</div>
              <h3 className="render-step-title">Code calculates the risk</h3>
            </div>
            <p className="render-step-desc">
              Server-side SQL & Python calculate safety buffer depletion, run-rates, and rupee revenue exposure with Decimal precision.
            </p>

            <div className="render-step-mockup">
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#e2e8f0', lineHeight: 1.5 }}>
                <span style={{ color: '#c084fc' }}>exposure</span> = (<span style={{ color: '#60a5fa' }}>velocity_{calcVelocity}</span> * <span style={{ color: '#fb7185' }}>lead_7d</span>) - <span style={{ color: '#34d399' }}>on_hand_14</span>
              </div>

              {/* Interactive Velocity Slider */}
              <div style={{ margin: '8px 0', padding: '6px 0' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 4 }} className="mono">
                  <span>Velocity: {calcVelocity} units/day</span>
                  <span style={{ color: '#fb7185' }}>Stockout: {Math.max(12, Math.round((14 / calcVelocity) * 24))}h</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="24"
                  value={calcVelocity}
                  onChange={(e) => setCalcVelocity(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#a855f7', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: 6, padding: '6px 10px' }}>
                <span style={{ fontSize: 11.5, color: '#fb7185', fontWeight: 600 }}>
                  Exposure: ₹{(calcVelocity * 7 * 400).toLocaleString('en-IN')}
                </span>
                <span className="mono" style={{ fontSize: 9.5, color: '#fff', background: '#e11d48', padding: '2px 6px', borderRadius: 3 }}>
                  CRITICAL
                </span>
              </div>

              <div style={{ fontSize: 11, color: '#64748b', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, marginTop: 8 }} className="mono">
                Zero AI Hallucination in Math
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div
            className={`render-step-col ${activePipelineStep === 3 ? 'active' : ''}`}
            onClick={() => setActivePipelineStep(3)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="render-step-num-badge">3</div>
              <h3 className="render-step-title">AI explains & audits</h3>
            </div>
            <p className="render-step-desc">
              Grounded natural language models explain the exact root cause citing verified business facts, then write immutable audit logs.
            </p>

            <div className="render-step-mockup">
              <div className="render-interactive-pill-row">
                <button
                  type="button"
                  className={`render-interactive-pill-btn ${step3View === 'summary' ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setStep3View('summary') }}
                >
                  Root Cause
                </button>
                <button
                  type="button"
                  className={`render-interactive-pill-btn ${step3View === 'audit' ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setStep3View('audit') }}
                >
                  Audit Record
                </button>
              </div>

              {step3View === 'summary' ? (
                <div style={{ fontSize: 11.5, color: '#cbd5e1', lineHeight: 1.55 }}>
                  “SKU #P104 safety stock breached. Projected stockout within {Math.max(12, Math.round((14 / calcVelocity) * 24))} hours. Recommended reorder: 40 units.”
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 4 }}>
                    <ShieldCheck size={14} color="#34d399" />
                    <span className="mono" style={{ fontSize: 10.5, color: '#34d399' }}>Audit #L-8821 Verified</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }} className="mono">
                    HASH: sha256:7f4c91b... · WAL COMMIT
                  </div>
                </div>
              )}

              <div style={{ fontSize: 11, color: '#64748b', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, marginTop: 8 }} className="mono">
                Append-only SQLite Ledger
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2B. OPERATE WITH ZERO BLIND SPOTS (RENDER SCREENSHOT 2 BENCHMARK) */}
      <section className="render-pipeline-section" style={{ paddingTop: 0 }}>
        <div className="render-zero-grid">
          {/* Left Column: Huge Editorial Headline with Inline Glowing Keywords */}
          <div className="render-keywords-container">
            <h2 className="render-section-title-large" style={{ marginBottom: 20 }}>
              Deploy operations and triage with zero blind spots.
            </h2>
            <p className="render-keywords-lead">
              Intuitive telemetry and automated signal processing across{' '}
              <span className="kw-inline purple">POS stream ingestion</span>,{' '}
              <span className="kw-inline cyan">warehouse stock ledgers</span>,{' '}
              <span className="kw-inline amber">depletion velocity</span>,{' '}
              <span className="kw-inline rose">safety buffer alerts</span>,{' '}
              <span className="kw-inline emerald">rupee exposure math</span>,{' '}
              <span className="kw-inline peach">reorder thresholds</span>,{' '}
              <span className="kw-inline indigo">root-cause AI analysis</span>,{' '}
              <span className="kw-inline mint">immutable SQLite WAL</span>, and{' '}
              <span className="kw-inline cyan">handheld mobile triage</span>.
            </p>
          </div>

          {/* Right Column: Interactive PR Preview Environment Card (Render Style) */}
          <div className="render-triage-preview-card">
            {/* PR Environment Header with Tab Selector */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="render-window-dots">
                  <span className="dot dot-red" />
                  <span className="dot dot-yellow" />
                  <span className="dot dot-green" />
                </div>
                <span className="mono" style={{ fontSize: 11, color: '#cbd5e1' }}>preview-env/nexus</span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {['108', '114', '122'].map((prNum) => (
                  <button
                    key={prNum}
                    type="button"
                    className={`render-interactive-pill-btn ${activePreviewPr === prNum ? 'active' : ''}`}
                    onClick={() => setActivePreviewPr(prNum)}
                    style={{ fontSize: 10, padding: '2px 6px' }}
                  >
                    PR #{prNum}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulated Git Branch Status Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 6, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }} className="mono">
                <GitBranch size={13} color="#a855f7" />
                <span style={{ color: '#cbd5e1' }}>
                  {activePreviewPr === '108' ? 'feature/safety-reconciler' : activePreviewPr === '114' ? 'feature/margin-guard' : 'feature/multi-store-sync'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#10b981' }} className="mono">
                <Check size={12} color="#10b981" />
                <span>Checks passed</span>
              </div>
            </div>

            {/* Preview Services List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="render-preview-flow-row active">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={14} color="#34d399" />
                  <span>pos-stream ingest</span>
                </span>
                <span className="mono" style={{ fontSize: 11, color: '#34d399' }}>Available · {activePreviewPr === '108' ? '0.18ms' : activePreviewPr === '114' ? '0.16ms' : '0.24ms'}</span>
              </div>

              <div className="render-preview-flow-row active">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={14} color="#34d399" />
                  <span>risk-calculation-engine</span>
                </span>
                <span className="mono" style={{ fontSize: 11, color: '#34d399' }}>Available · {activePreviewPr === '108' ? '0.22ms' : activePreviewPr === '114' ? '0.19ms' : '0.28ms'}</span>
              </div>

              <div className="render-preview-flow-row active">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={14} color="#34d399" />
                  <span>grounded-ai-investigation</span>
                </span>
                <span className="mono" style={{ fontSize: 11, color: '#34d399' }}>Available · {activePreviewPr === '108' ? '0.41ms' : activePreviewPr === '114' ? '0.38ms' : '0.45ms'}</span>
              </div>

              <div className="render-preview-flow-row active">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={14} color="#34d399" />
                  <span>sqlite-wal-audit-ledger</span>
                </span>
                <span className="mono" style={{ fontSize: 11, color: '#34d399' }}>Available · {activePreviewPr === '108' ? '0.08ms' : activePreviewPr === '114' ? '0.07ms' : '0.11ms'}</span>
              </div>
            </div>

            <div style={{ fontSize: 11, color: '#64748b', marginTop: 12 }} className="mono">
              * Evaluates in {activePreviewPr === '108' ? '0.18ms' : activePreviewPr === '114' ? '0.16ms' : '0.24ms'} · Zero synthetic noise · Authoritative SQLite schema
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. INTERACTIVE CENTRAL PRODUCT TRAIL ────────────────────────── */}
      <section id="trail" className="render-pipeline-section" style={{ paddingTop: 0 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <TechnicalLabel value={t('landing.trailEyebrow')} variant="cyan" size="sm" />
          <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, color: '#fff', marginTop: 10 }}>
            {t('landing.trailHeadline')}
          </h2>
          <p style={{ fontSize: 14, color: '#94a3b8', maxWidth: 640, margin: '8px auto 0' }}>
            {t('landing.trailSubtitle')}
          </p>
        </div>

        <div className="trail-diagram-wrap" style={{ background: '#090a0f', borderColor: 'rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Cpu size={18} color="#a855f7" />
              <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
                NEXUS OPERATIONAL TRAIL
              </span>
            </div>
            <span className="mono" style={{ fontSize: 11, color: '#64748b' }}>
              {t('landing.trailInteractiveHint')}
            </span>
          </div>

          {/* Interactive Flow Nodes */}
          <div className="trail-nodes-flow" role="tablist" aria-label="NEXUS trail progression">
            {trailNodes.map((node) => {
              const Icon = node.icon
              const isActive = activeTrailId === node.id
              return (
                <button
                  key={node.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`trail-node-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTrailId(node.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="trail-node-step">{node.num}</span>
                    <Icon size={14} color={isActive ? node.color : '#64748b'} />
                  </div>
                  <div className="trail-node-title">{node.title}</div>
                  <div className="trail-node-sub">{node.sub}</div>
                </button>
              )
            })}
          </div>

          {/* Inspector Panel for Selected Node */}
          <div className="trail-inspector-panel" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}>
            <div style={{ flexShrink: 0, marginTop: 2 }}>
              {activeTrailNode.icon && (
                <activeTrailNode.icon size={22} color={activeTrailNode.color} />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                  Stage {activeTrailNode.num}: {activeTrailNode.title}
                </span>
                <TechnicalLabel value={activeTrailNode.badge} variant="cyan" size="xs" />
              </div>
              <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                {activeTrailNode.detail}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. TELEMETRY & WORKFLOW DUAL SHOWCASE (RENDER SCREENSHOT 4 & 5) */}
      <section className="render-pipeline-section" style={{ paddingTop: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 40, alignItems: 'center', marginBottom: 40 }}>
          <div>
            <h2 className="render-section-title-large" style={{ marginBottom: 16 }}>
              Real-time velocity tracking that handles demand surges and stockout threats.
            </h2>
            <p style={{ fontSize: 14.5, color: '#94a3b8', lineHeight: 1.65, marginBottom: 24 }}>
              Keep your retail inventory running smoothly through viral spikes, festival seasons, and supplier delays. NEXUS continuously cross-references sales velocity with safety buffer depletion to deterministically project stockouts before margins erode.
            </p>
            <Link to="/" style={{ color: '#a78bfa', fontWeight: 600, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Explore Risk Intelligence <ArrowRight size={14} />
            </Link>
          </div>

          <div style={{ background: '#090a0f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 24, boxShadow: '0 20px 48px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span className="mono" style={{ fontSize: 11, color: '#64748b' }}>COMPUTE PLAN: SQLITE STRICT · DECIMAL MATH</span>
              <VerifiedBadge />
            </div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ILLUSTRATIVE_AREA} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="renderTelemetryGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Area type="monotone" dataKey="val" name="Recent 7D" stroke="#a855f7" strokeWidth={2} fill="url(#renderTelemetryGrad)" />
                  <Area type="monotone" dataKey="prior" name="Prior 7D" stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="3 3" fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Dual Technical Cards: Python Math + Live Audit Log (Render Screenshot 5) */}
        <div className="render-telemetry-grid">
          <div className="render-code-card">
            {/* Interactive Tab Bar */}
            <div className="render-code-tab-bar">
              <button
                type="button"
                className={`render-code-tab ${activeCodeTab === 'python' ? 'active' : ''}`}
                onClick={() => setActiveCodeTab('python')}
              >
                Python (Risk Rules)
              </button>
              <button
                type="button"
                className={`render-code-tab ${activeCodeTab === 'fastapi' ? 'active' : ''}`}
                onClick={() => setActiveCodeTab('fastapi')}
              >
                FastAPI (Controller)
              </button>
              <button
                type="button"
                className={`render-code-tab ${activeCodeTab === 'sqlite' ? 'active' : ''}`}
                onClick={() => setActiveCodeTab('sqlite')}
              >
                SQLite (WAL Schema)
              </button>
            </div>

            {activeCodeTab === 'python' && (
              <div>
                <span className="code-keyword">@nexus.deterministic_engine</span><br />
                <span className="code-keyword">def</span> <span className="code-fn">calculate_stockout_risk</span>(stock_on_hand, velocity_7d, lead_days):<br />
                &nbsp;&nbsp;<span className="code-comment"># Code calculates with Decimal precision</span><br />
                &nbsp;&nbsp;days_remaining = stock_on_hand / velocity_7d<br />
                &nbsp;&nbsp;<span className="code-keyword">if</span> days_remaining &lt; lead_days:<br />
                &nbsp;&nbsp;&nbsp;&nbsp;<span className="code-keyword">return</span> &#123;<br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="code-str">"threat"</span>: <span className="code-keyword">True</span>,<br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="code-str">"exposure"</span>: velocity_7d * price,<br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="code-str">"urgency_hours"</span>: int(days_remaining * 24)<br />
                &nbsp;&nbsp;&nbsp;&nbsp;&#125;
              </div>
            )}

            {activeCodeTab === 'fastapi' && (
              <div>
                <span className="code-keyword">@router.get</span>(<span className="code-str">"/api/v1/risks/priorities"</span>)<br />
                <span className="code-keyword">async def</span> <span className="code-fn">get_priorities</span>(tenant_id: UUID = Depends(auth)):<br />
                &nbsp;&nbsp;<span className="code-comment"># Strict tenant scoping & RBAC isolation</span><br />
                &nbsp;&nbsp;risks = <span className="code-keyword">await</span> risk_repo.get_active(tenant_id)<br />
                &nbsp;&nbsp;<span className="code-keyword">return</span> [r.to_pydantic() <span className="code-keyword">for</span> r <span className="code-keyword">in</span> risks]
              </div>
            )}

            {activeCodeTab === 'sqlite' && (
              <div>
                <span className="code-keyword">CREATE TABLE</span> <span className="code-fn">business_risks</span> (<br />
                &nbsp;&nbsp;id <span className="code-str">TEXT PRIMARY KEY</span>,<br />
                &nbsp;&nbsp;tenant_id <span className="code-str">TEXT NOT NULL</span>,<br />
                &nbsp;&nbsp;severity <span className="code-str">TEXT CHECK (severity IN ('HIGH','MED','LOW'))</span>,<br />
                &nbsp;&nbsp;state <span className="code-str">TEXT DEFAULT 'OPEN'</span>,<br />
                &nbsp;&nbsp;created_at <span className="code-str">TIMESTAMP DEFAULT CURRENT_TIMESTAMP</span><br />
                );
              </div>
            )}
          </div>

          <div className="render-log-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="status-dot-pulse-wrap">
                  <span className="status-dot-radar-ring" />
                  <span className="status-dot-pulse" style={{ width: 6, height: 6 }} />
                </div>
                <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600 }}>Live Immutable Audit Stream</span>
              </div>
              <button
                type="button"
                onClick={handleSimulateSale}
                className="render-interactive-pill-btn"
                style={{ padding: '2px 8px', fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                title="Append test POS sale to live log"
              >
                <Plus size={10} /> Simulate Sale
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {logEvents.map((log) => (
                <div key={log.id} className="render-log-line">
                  <span className="render-log-time">{log.time}</span>
                  <span className={`render-log-tag ${log.tag}`}>{log.tag.toUpperCase()}</span>
                  <span>{log.text}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 6, fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center' }}>
              <span>Awaiting telemetry packets</span>
              <span className="terminal-cursor" />
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. FEATURE MATRIX 4-COLUMN GRID (RENDER SCREENSHOT 2 / 2ND SET) */}
      <section id="features" className="render-pipeline-section" style={{ paddingTop: 0 }}>
        <h2 className="render-section-title-large">
          Intuitive infrastructure, designed for operators.
        </h2>
        <p style={{ fontSize: 14.5, color: '#94a3b8', margin: '-24px 0 32px' }}>
          Operate with verified clarity using integrated primitives that just work.
        </p>

        <div className="render-matrix-grid">
          <div className="render-matrix-card">
            <Cpu size={20} color="#a855f7" />
            <h3 className="render-matrix-title">Deterministic Engine</h3>
            <p className="render-matrix-desc">
              All stock positions, depletion rates, and priority scores execute strictly in Python & SQL algorithms.
            </p>
          </div>

          <div className="render-matrix-card">
            <Database size={20} color="#38bdf8" />
            <h3 className="render-matrix-title">Tenant-Isolated Data</h3>
            <p className="render-matrix-desc">
              Authoritative SQLite tables enforce multi-tenant isolation with zero simulated client state.
            </p>
          </div>

          <div className="render-matrix-card">
            <AlertTriangle size={20} color="#fb7185" />
            <h3 className="render-matrix-title">Cross-Domain Risk</h3>
            <p className="render-matrix-desc">
              Correlates sales acceleration with safety stock depletion to detect urgent risks early.
            </p>
          </div>

          <div className="render-matrix-card">
            <Coins size={20} color="#f59e0b" />
            <h3 className="render-matrix-title">Rupee Exposure</h3>
            <p className="render-matrix-desc">
              Translates operational bottlenecks into quantifiable daily revenue exposure and trapped working capital.
            </p>
          </div>

          <div className="render-matrix-card">
            <Sparkles size={20} color="#c084fc" />
            <h3 className="render-matrix-title">Grounded AI Investigation</h3>
            <p className="render-matrix-desc">
              Language models cite verified database facts with calibrated confidence scores to explain anomalies.
            </p>
          </div>

          <div className="render-matrix-card">
            <ShieldCheck size={20} color="#34d399" />
            <h3 className="render-matrix-title">Immutable Audit Trail</h3>
            <p className="render-matrix-desc">
              Every triage action and inventory mutation is permanently recorded to append-only logs.
            </p>
          </div>

          <div className="render-matrix-card">
            <Smartphone size={20} color="#38bdf8" />
            <h3 className="render-matrix-title">Handheld Architecture</h3>
            <p className="render-matrix-desc">
              Persistent 5-anchor mobile navigation, slide-up bottom sheets, and touch-friendly triage.
            </p>
          </div>

          <div className="render-matrix-card">
            <Globe2Icon size={20} color="#a855f7" />
            <h3 className="render-matrix-title">Bilingual Operational Shell</h3>
            <p className="render-matrix-desc">
              Instant toggling between English and professional Hindi business terminology.
            </p>
          </div>
        </div>
      </section>

      {/* ── 6. PROGRESSIVE DEPTH MODEL SECTION ──────────────────────────── */}
      <section id="depth" className="render-pipeline-section" style={{ paddingTop: 0 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <TechnicalLabel value={t('landing.depthEyebrow')} variant="brand" size="sm" />
          <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, color: '#fff', marginTop: 10 }}>
            {t('landing.depthHeadline')}
          </h2>
          <p style={{ fontSize: 14, color: '#94a3b8', maxWidth: 680, margin: '8px auto 0' }}>
            {t('landing.depthSubtitle')}
          </p>
        </div>

        <div className="depth-disclosure-wrap" style={{ background: '#090a0f', borderColor: 'rgba(255,255,255,0.08)' }}>
          {/* Nav Tabs for the 5 levels */}
          <div className="depth-nav-tabs" role="tablist" aria-label="Progressive depth levels">
            {depthLevels.map((lvl, idx) => {
              const isActive = activeDepthLevel === idx
              return (
                <button
                  key={lvl.tag}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`depth-tab-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveDepthLevel(idx)}
                >
                  <span className="depth-tab-tag">{lvl.tag}</span>
                  <span className="depth-tab-title">{lvl.title}</span>
                </button>
              )
            })}
          </div>

          {/* Active Level Content Panel */}
          <div className="depth-content-panel" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {activeLevel.icon && <activeLevel.icon size={18} color="#a855f7" />}
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                    {activeLevel.title}
                  </span>
                </div>
                <TechnicalLabel value={activeLevel.badge} variant="cyan" size="xs" />
              </div>

              <p style={{ fontSize: 13.5, color: '#94a3b8', lineHeight: 1.6, margin: '0 0 16px' }}>
                {activeLevel.summary}
              </p>

              <div className="depth-example-box" style={{ background: 'rgba(255, 255, 255, 0.03)', borderColor: 'rgba(255, 255, 255, 0.08)', borderLeftColor: '#a855f7' }}>
                <span className="mono" style={{ fontSize: 10.5, color: '#a855f7', display: 'block', marginBottom: 4 }}>
                  ILLUSTRATIVE DRILLDOWN:
                </span>
                {activeLevel.example}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14, fontSize: 12, color: '#64748b' }}>
              <span>Step {activeDepthLevel + 1} of 5</span>
              <button
                type="button"
                onClick={() => setActiveDepthLevel((prev) => (prev + 1) % depthLevels.length)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#a78bfa',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Next Level <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. PRESERVED TOPOLOGY PIPELINE ─────────────────────────────── */}
      <section id="topology" className="render-pipeline-section" style={{ paddingTop: 0 }}>
        <IntelligencePipeline />
      </section>

      {/* ── 8. DISTINCTIVE PHILOSOPHICAL STATEMENT & CENTERED CTA ─ */}
      <section className="render-pipeline-section" style={{ paddingTop: 0 }}>
        <div className="philosophical-statement-wrap" style={{ padding: '20px 24px 40px' }}>
          <div className="philosophical-line">{t('landing.statementLine1')}</div>
          <div className="philosophical-line">{t('landing.statementLine2')}</div>
          <div className="philosophical-line accent">{t('landing.statementLine3')}</div>
          <div className="philosophical-line">{t('landing.statementLine4')}</div>
          <div className="philosophical-line gradient">{t('landing.statementLine5')}</div>
        </div>

        <div className="render-floating-tiles-canvas">
          {/* Floating Colored Square Badges in 3D Space (Render Screenshot 8) */}
          <div className="render-floating-tile tile-shopify" title="Shopify POS Integration">
            <span style={{ fontSize: 20 }}>🛍️</span>
            <span>Shopify</span>
          </div>
          <div className="render-floating-tile tile-tally" title="Tally Prime ERP">
            <span style={{ fontSize: 20 }}>📊</span>
            <span>Tally</span>
          </div>
          <div className="render-floating-tile tile-zoho" title="Zoho Books">
            <span style={{ fontSize: 20 }}>💼</span>
            <span>Zoho</span>
          </div>
          <div className="render-floating-tile tile-fastapi" title="FastAPI Engine">
            <span style={{ fontSize: 20 }}>⚡</span>
            <span>FastAPI</span>
          </div>
          <div className="render-floating-tile tile-python" title="Python 3.12">
            <span style={{ fontSize: 20 }}>🐍</span>
            <span>Python</span>
          </div>
          <div className="render-floating-tile tile-sqlite" title="SQLite WAL">
            <span style={{ fontSize: 20 }}>🗄️</span>
            <span>SQLite</span>
          </div>
          <div className="render-floating-tile tile-postgres" title="PostgreSQL 16">
            <span style={{ fontSize: 20 }}>🛡️</span>
            <span>Postgres</span>
          </div>
          <div className="render-floating-tile tile-razorpay" title="Razorpay POS">
            <span style={{ fontSize: 20 }}>💳</span>
            <span>Razorpay</span>
          </div>
          <div className="render-floating-tile tile-redis" title="Redis Stream">
            <span style={{ fontSize: 20 }}>🔥</span>
            <span>Redis</span>
          </div>
          <div className="render-floating-tile tile-react" title="React 18">
            <span style={{ fontSize: 20 }}>⚛️</span>
            <span>React</span>
          </div>
          <div className="render-floating-tile tile-docker" title="Docker Container">
            <span style={{ fontSize: 20 }}>🐳</span>
            <span>Docker</span>
          </div>
          <div className="render-floating-tile tile-graphql" title="GraphQL Mesh">
            <span style={{ fontSize: 20 }}>🕸️</span>
            <span>GraphQL</span>
          </div>
          <div className="render-floating-tile tile-django" title="Django Admin">
            <span style={{ fontSize: 20 }}>🎯</span>
            <span>Django</span>
          </div>
          <div className="render-floating-tile tile-aws" title="AWS Cloud Infrastructure">
            <span style={{ fontSize: 20 }}>☁️</span>
            <span>AWS</span>
          </div>

          <div
            className="render-cta-wrap"
            style={{
              margin: '0 auto',
              zIndex: 10,
              maxWidth: 640,
              width: '100%',
              background: '#090a0f',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 32px 80px rgba(0, 0, 0, 0.95), 0 0 50px rgba(0, 0, 0, 0.9)',
            }}
          >
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#fff', margin: '0 0 12px 0', letterSpacing: '-0.03em' }}>
              Start operating with NEXUS
            </h2>
            <p style={{ fontSize: 15, color: '#94a3b8', maxWidth: 520, margin: '0 auto 28px', lineHeight: 1.6 }}>
              Zero blind spots. Zero synthetic metrics. Simple to operate. Deep when you need it.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
              <Link to="/">
                <button type="button" className="render-btn-white" style={{ padding: '14px 28px', fontSize: 15 }}>
                  <span>Launch Workstation</span>
                  <ArrowRight size={16} />
                </button>
              </Link>
            </div>

            <div style={{ marginTop: 24 }}>
              <span className="mono" style={{ fontSize: 11, color: '#64748b' }}>
                {t('landing.illustrativeDisclaimer')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. CLEAN MULTI-COLUMN FOOTER (RENDER SCREENSHOT 3 / 2ND SET) ─ */}
      <footer className="render-footer-section">
        <div className="render-footer-grid">
          <div className="render-footer-col">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 20V4l16 16V4"
                  stroke="#3b82f6"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.12em', color: '#fff' }}>
                NEXUS
              </span>
            </div>
            <p style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.6, maxWidth: 280, margin: '8px 0 0' }}>
              Business data becomes intelligence. Intelligence reveals operational risk. Code calculates. AI explains.
            </p>
          </div>

          <div className="render-footer-col">
            <div className="render-footer-heading">Product</div>
            <Link to="/" className="render-footer-link">Command Center</Link>
            <Link to="/inventory" className="render-footer-link">Inventory Ledger</Link>
            <Link to="/risk-queue" className="render-footer-link">Risk Intelligence</Link>
            <Link to="/financial" className="render-footer-link">Financial Terminal</Link>
          </div>

          <div className="render-footer-col">
            <div className="render-footer-heading">Architecture</div>
            <button type="button" onClick={() => scrollTo('workflow')} className="render-footer-link" style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}>3-Step Flow</button>
            <button type="button" onClick={() => scrollTo('trail')} className="render-footer-link" style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}>Operating Trail</button>
            <button type="button" onClick={() => scrollTo('topology')} className="render-footer-link" style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}>System Topology</button>
            <Link to="/resources" className="render-footer-link">Knowledge Map</Link>
          </div>

          <div className="render-footer-col">
            <div className="render-footer-heading">Principles</div>
            <span className="render-footer-link" style={{ color: '#94a3b8' }}>Deterministic Math</span>
            <span className="render-footer-link" style={{ color: '#94a3b8' }}>Grounded AI</span>
            <span className="render-footer-link" style={{ color: '#94a3b8' }}>Immutable Audit</span>
            <span className="render-footer-link" style={{ color: '#94a3b8' }}>Bilingual EN + HI</span>
          </div>

          <div className="render-footer-col">
            <div className="render-footer-heading">Tenant Session</div>
            <span className="render-footer-link" style={{ color: '#10b981' }}>● SQLite Local DB</span>
            <span className="render-footer-link" style={{ color: '#64748b' }}>Role: OWNER</span>
            <span className="render-footer-link" style={{ color: '#64748b' }}>Tenant: Verified</span>
          </div>
        </div>

        <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 20, fontSize: 12, color: '#64748b', flexWrap: 'wrap', gap: 12 }}>
          <span className="mono">NEXUS V2.0 · {t('global.codeCalculatesAiExplains')}</span>
          <span>{t('landing.footerCopyright')}</span>
        </div>
      </footer>
    </div>
  )
}

function Globe2Icon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  )
}
