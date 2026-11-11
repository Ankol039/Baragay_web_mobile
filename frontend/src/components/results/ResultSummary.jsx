import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import { Link } from 'react-router-dom'
import Card from '../common/Card.jsx'

export default function ResultSummary({ survey, totalRespondents }) {
  return <>
    <div className="grid-2 mb-4">
      <div className="stat-card"><div className="stat-number">{totalRespondents}</div><div className="stat-label">Total Respondents</div></div>
      <div className="stat-card"><div className="stat-number" style={{ fontSize: '1.4rem', paddingTop: 8 }}>{survey.period_label}</div><div className="stat-label">Survey Collection Period</div></div>
    </div>
    <Card><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div><h2 style={{ marginBottom: 4 }}>{survey.title}</h2><p style={{ color: 'var(--muted)', marginTop: 0 }}>
        <span className={`badge ${survey.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>{survey.status.charAt(0).toUpperCase() + survey.status.slice(1)}</span>
      </p></div>
      <div className="no-print"><Link className="btn" to={`/staff/reports?survey_id=${survey.survey_id}`}>Printable Report</Link></div>
    </div></Card>
  </>
}

if (import.meta.env.DEV) {
  ResultSummary.propTypes = {
    survey: record.isRequired,
    totalRespondents: PropTypes.number.isRequired,
  }
}
