const LABELS = {
  OPEN: 'OPEN',
  ACKNOWLEDGED: 'ACK',
  RESOLVED: 'DONE',
  DISMISSED: 'DISMISSED',
}

export default function StatePill({ state }) {
  const cls = state.toLowerCase()
  return <span className={`pill ${cls}`}>{LABELS[state] ?? state}</span>
}
