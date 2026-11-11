import { records } from '../../propTypes.js'
import { Link } from 'react-router-dom'
import ChartCard from '../charts/ChartCard.jsx'
import Icon from '../common/Icon.jsx'

export default function DashboardSurveys({ rows }) {
  return <ChartCard title="Surveys" note="Most recent first, with the responses each has collected." className="db-c8" meta={<span className="db-panel-meta">{rows.length} shown</span>}>
    <div className="db-table-wrap"><table><tbody>
      <tr>{['Survey', 'Period', 'Status', 'Responses', 'Action'].map(label => <th key={label}>{label}</th>)}</tr>
      {!rows.length && <tr><td colSpan="5" className="empty-state">No surveys yet.</td></tr>}
      {rows.map(row => <tr key={row.survey_id}>
        <td>{row.title}</td><td>{row.start_date} – {row.end_date}</td>
        <td><span className={`badge badge-${['active', 'inactive'].includes(row.status) ? row.status : 'draft'}`}>{row.status.charAt(0).toUpperCase() + row.status.slice(1)}</span></td>
        <td>{Number(row.response_count) > 0 ? row.response_count : <span className="muted-note">No responses yet</span>}</td>
        <td><Link className="btn-action btn-action-primary" title="View Results" to={`/staff/results-dashboard?survey_id=${row.survey_id}`}><Icon name="results" /></Link></td>
      </tr>)}
    </tbody></table></div>
  </ChartCard>
}

if (import.meta.env.DEV) {
  DashboardSurveys.propTypes = {
    rows: records.isRequired,
  }
}
