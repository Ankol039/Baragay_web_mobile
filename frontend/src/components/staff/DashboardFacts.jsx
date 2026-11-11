import { record, records } from '../../propTypes.js'
import KeyValueList from '../common/KeyValueList.jsx'
import ChartCard from '../charts/ChartCard.jsx'

export default function DashboardFacts({ data: d }) {
  return <ChartCard title="At a Glance" className="db-c4"><KeyValueList rows={[
    ['Inactive surveys', d.inactive_surveys], ['Past closing date', d.closed_surveys],
    ['Avg. responses / survey', d.avg_responses],
    ['Residents who answered', `${d.responding_residents} of ${d.eligible_residents} (${d.participation}%)`],
    ['Responses this week', d.responses_7], ['Last response', d.latest_response_label],
  ]} /></ChartCard>
}
export function ResidentRanking({ rows }) {
  return <ChartCard title="Most Active Residents" note="Ranked by surveys answered." className="db-c4">
    {!rows.length ? <div className="db-empty">No one has answered a survey yet.</div> : <ul className="db-rank">{rows.map((row, i) => <li key={row.resident_id}>
      <span className="db-rank-pos">{i + 1}</span><span className="db-rank-name">{`${row.first_name} ${row.last_name}`.trim()}<span className="db-rank-sub">{row.resident_number}</span></span><span className="db-rank-val">{row.answered}</span>
    </li>)}</ul>}
  </ChartCard>
}

if (import.meta.env.DEV) {
  DashboardFacts.propTypes = {
    data: record.isRequired,
  }
  ResidentRanking.propTypes = {
    rows: records.isRequired,
  }
}
