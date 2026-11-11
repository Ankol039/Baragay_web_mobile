import { record } from '../../propTypes.js'
import MetricCell from '../common/MetricCell.jsx'

export default function MetricStrip({ data }) {
  const { available_count: available, answered_count: answered, assigned_total: assigned,
    completion_pct: pct, next_deadline_label: deadline, days_left: days } = data
  const metrics = [
    ['available', 'Waiting for You', available, available > 0 ? 'Open and not yet answered' : 'Nothing pending right now'],
    ['completed', 'Completed', answered, 'Answers already recorded'],
    ['assigned', 'Assigned to You', assigned, `${pct}% completed`],
  ]
  return <div className="db-strip" style={{ marginTop: 18 }}>
    {metrics.map(([view, label, value, foot]) => <MetricCell key={view} label={label} value={value} foot={foot} to={`/resident/stat-detail?view=${view}`} />)}
    <MetricCell label="Next Closing Date" value={deadline || 'None'} small foot={days === null ? 'No surveys closing soon' : days <= 3
      ? <span className="db-delta is-down">{days <= 0 ? 'Closes today' : `${days} day${days === 1 ? '' : 's'} left`}</span>
      : `${days} days left`} />
  </div>
}

if (import.meta.env.DEV) {
  MetricStrip.propTypes = {
    data: record.isRequired,
  }
}
