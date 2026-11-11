import PropTypes from 'prop-types'
import { record, records } from '../../propTypes.js'
import { Link } from 'react-router-dom'
import ChartCard from '../charts/ChartCard.jsx'
import { AdminMetrics } from './DashboardMetrics.jsx'
import { PortalBars } from './DashboardBars.jsx'

function ActivityTable({ rows, logout }) {
  return <div className="db-table-wrap">{logout && !rows.length ? <div className="db-empty">No sign-outs recorded yet.</div> : <table className={logout ? 'db-table' : undefined}>
    <thead><tr><th>User</th><th>Type</th><th>Date &amp; Time</th></tr></thead><tbody>
      {!rows.length && <tr><td colSpan="3" className="empty-state">No login activity recorded yet.</td></tr>}
      {rows.map((row, i) => <tr key={i}><td>{row.person}</td><td><span className={`db-pill ${row.type_label.pill}`}>{row.type_label.text}</span></td><td>{row.time_label}</td></tr>)}
    </tbody>
  </table>}</div>
}
function ActivityRow({ rows, counts, logout = false }) {
  const title = logout ? 'Logout' : 'Login'
  const event = logout ? 'sign-outs' : 'sign-ins'
  return <div className="db-grid">
    <ChartCard title={`Recent ${title} Activity`} note={`Most recent ${event} across both portals, newest first.`} className="db-c8"
      meta={<Link className="db-panel-meta" to={`/staff/stat-detail?view=recent_${logout ? 'logouts' : 'logins'}`}>View all</Link>}>
      <ActivityTable rows={rows} logout={logout} />
    </ChartCard>
    <ChartCard title={`${logout ? 'Sign-outs' : 'Sign-ins'} by Portal`} note={`Of the ${rows.length} most recent ${event}.`} className="db-c4"><PortalBars counts={counts} /></ChartCard>
  </div>
}
export default function AdminAccess({ data }) {
  return <>
    <div className="db-section-head"><h2>Administration</h2></div>
    <div className="db-admin">
      <div className="db-admin-head"><h2>Accounts &amp; Access</h2><span className="db-pill db-pill-admin">Admin only</span></div>
      <AdminMetrics data={data} />
      <ActivityRow rows={data.recent_logins} counts={data.login_counts} />
      <ActivityRow rows={data.recent_logouts} counts={data.logout_counts} logout />
    </div>
  </>
}

if (import.meta.env.DEV) {
  ActivityTable.propTypes = {
    rows: records.isRequired,
    logout: PropTypes.bool,
  }
  ActivityRow.propTypes = {
    rows: records.isRequired,
    counts: record.isRequired,
    logout: PropTypes.bool,
  }
  AdminAccess.propTypes = {
    data: record.isRequired,
  }
}
