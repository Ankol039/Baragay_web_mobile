import { record } from '../../propTypes.js'
import { Link } from 'react-router-dom'
import ChartCard from '../charts/ChartCard.jsx'
import Icon from '../common/Icon.jsx'

export default function DashboardTables({ data }) {
  return <div className="db-grid">
    <ChartCard title="Surveys Closing Soon" note="Open surveys you have not answered, soonest deadline first." className="db-c8"
      meta={<span className="db-panel-meta">{data.upcoming.length} open</span>}>
      <div className="db-table-wrap"><table><thead><tr><th>Survey</th><th>Closes On</th><th>Action</th></tr></thead>
        <tbody>{data.upcoming.length === 0 && <tr><td colSpan={3} className="empty-state">You're all caught up — no pending surveys.</td></tr>}
          {data.upcoming.map(row => <tr key={row.survey_id}>
            <td>{row.title}</td><td>{row.end_date_label}</td>
            <td><Link className="btn-action btn-action-primary" to={`/resident/survey-form?id=${row.survey_id}`} title="Answer Survey"><Icon name="surveys" /></Link></td>
          </tr>)}
        </tbody></table></div>
    </ChartCard>
    <ChartCard title="Recently Submitted" note="Your last few answers." className="db-c4">
      {data.recent_submissions.length === 0 ? <div className="db-empty">You haven't submitted a survey yet. Start with one from Available Surveys.</div>
        : <><ul className="db-rank">{data.recent_submissions.map((row, index) => <li key={index}>
          <span className="db-rank-pos"><Icon name="check" /></span>
          <span className="db-rank-name">{row.title}<span className="db-rank-sub">{row.submitted_at_label}</span></span>
        </li>)}</ul><Link className="view-all-link" to="/resident/history" style={{ display: 'inline-block', marginTop: 10 }}>View all submissions</Link></>}
    </ChartCard>
  </div>
}

if (import.meta.env.DEV) {
  DashboardTables.propTypes = {
    data: record.isRequired,
  }
}
