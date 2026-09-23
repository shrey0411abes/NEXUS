export default function KpiCard({ label, value, tone }) {
  const toneClass = tone ? `kpi-val ${tone}-num` : 'kpi-val'
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={toneClass}>{value}</div>
    </div>
  )
}
