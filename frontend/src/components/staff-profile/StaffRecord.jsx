import { record } from '../../propTypes.js'
import { Fragment } from 'react'
import { Link } from 'react-router-dom'

export default function StaffRecord({ data }) {
  const { account, is_admin, onboarding } = data
  const rows = [['Staff Number', account.staff_number ?? 'N/A'], ['Username', account.username], ['Full name', account.display_name],
    ['Date hired', account.date_hired || 'N/A'], ['Role', account.role.charAt(0).toUpperCase() + account.role.slice(1)]]
  return <div className="card"><div className="card-head"><h2 className="card-head-title">{is_admin ? 'Admin Record' : 'Staff Record'}</h2></div>
    {onboarding && <div className="alert alert-info">Your name and role are set by the administrator. Everything below the photo is yours to enter and yours to change later.</div>}
    <dl className="credential-slip">{rows.map(([key, value]) => <Fragment key={key}><dt>{key}</dt><dd>{value}</dd></Fragment>)}</dl>
    <p className="field-hint">Need a new password? <Link to="/staff/change-password">Change your password</Link>.</p>
  </div>
}

if (import.meta.env.DEV) {
  StaffRecord.propTypes = {
    data: record.isRequired,
  }
}
