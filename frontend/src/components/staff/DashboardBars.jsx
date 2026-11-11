import PropTypes from 'prop-types'
import { record, records } from '../../propTypes.js'
import ChartCard from '../charts/ChartCard.jsx'

export function DashboardBars({ rows, empty }) {
  return !rows.length ? <div className="db-empty">{empty}</div> : <div className="db-bars">{rows.map(row => <div className={`db-bar-row${row.sub ? ' db-bar-sub' : ''}`} key={row.label}>
    <div className="db-bar-head"><span className="db-bar-label">{row.label}</span><span className="db-bar-value">{row.value}</span></div>
    <div className="db-bar-track"><span className={`db-bar-fill${row.fill ? ` ${row.fill}` : ''}`} style={{ width: `${row.width}%` }} /></div>
  </div>)}</div>
}
export default function QuestionTypes({ rows, error, loading }) {
  const max = Math.max(...(rows || []).map(row => row.value), 1)
  return <ChartCard title="Question Types in Use" note="Across every survey built so far." className="db-c4"><div id="question-mix">
    {loading || error ? <div className="db-empty">{error ? 'Chart data could not be loaded. Refresh the page to try again.' : 'Loading question mix…'}</div>
      : <DashboardBars rows={rows.map(row => ({ ...row, width: Math.round(row.value / max * 100) }))} empty="No questions have been added to a survey yet." />}
  </div></ChartCard>
}
export function PortalBars({ counts }) {
  const total = counts.admin + counts.staff + counts.resident
  const types = [
    ['admin', 'Admin portal', 'db-fill-admin'], ['staff', 'Staff portal', ''], ['resident', 'Resident portal', 'db-fill-alt'],
    ['permanent', 'Permanent resident portal', 'db-fill-permanent', true], ['temporary', 'Temporary resident portal', 'db-fill-temporary', true],
  ]
  return <DashboardBars rows={total ? types.map(([key, label, fill, sub]) => ({ label, fill, sub, value: counts[key], width: Math.round(counts[key] / total * 100) })) : []} empty="Nothing recorded yet." />
}

if (import.meta.env.DEV) {
  DashboardBars.propTypes = {
    rows: records.isRequired,
    empty: PropTypes.node.isRequired,
  }
  QuestionTypes.propTypes = {
    rows: records,
    error: PropTypes.string,
    loading: PropTypes.bool,
  }
  PortalBars.propTypes = {
    counts: record.isRequired,
  }
}
