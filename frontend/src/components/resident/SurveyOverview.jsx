import { record } from '../../propTypes.js'
import ChartCard from '../charts/ChartCard.jsx'
import Icon from '../common/Icon.jsx'

export default function SurveyOverview({ data }) {
  const { available_count: available, answered_count: answered, assigned_total: assigned, completion_pct: pct, next_deadline_label: deadline } = data
  const items = [
    ['surveys', `${available} waiting for your answer`, available > 0 ? 'Open now and not yet answered.' : 'Nothing pending right now.'],
    ['check', `${answered} already submitted`, 'Your answers are recorded and cannot be changed.'],
    ['clock', deadline || 'No upcoming deadline', deadline ? 'Closing date of your next survey.' : 'You have no surveys closing soon.'],
  ]
  return <ChartCard title="Survey Overview" className="db-c4">
    <div className="overview-progress"><span style={{ width: `${pct}%` }} /></div>
    <span className="meter-note">{answered} of {assigned} surveys completed ({pct}%)</span>
    <ul className="overview-list" style={{ marginTop: 12 }}>{items.map(([icon, title, note]) => <li key={icon}>
      <span className="overview-icon"><Icon name={icon} /></span>
      <span className="overview-text"><strong>{title}</strong><span>{note}</span></span>
    </li>)}</ul>
  </ChartCard>
}

if (import.meta.env.DEV) {
  SurveyOverview.propTypes = {
    data: record.isRequired,
  }
}
