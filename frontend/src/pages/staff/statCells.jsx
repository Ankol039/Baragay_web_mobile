import { Link } from 'react-router-dom'

const ucfirst = value => value.charAt(0).toUpperCase() + value.slice(1)
const badge = (text, active) => <span className={`badge ${active ? 'badge-active' : 'badge-inactive'}`}>{text}</span>
const account = row => badge(Number(row.is_active) === 1 ? 'Active' : 'Deactivated', Number(row.is_active) === 1)
const resident = row => [row.resident_number, `${row.first_name} ${row.last_name}`, row.contact_number || '—', ucfirst(row.residency_status || '—')]
const results = row => <Link to={`/staff/results-dashboard?survey_id=${row.survey_id}`}>View Results</Link>

export const statCells = {
  total_surveys: row => [row.title, `${row.start_date_label} – ${row.end_date_label}`, badge(ucfirst(row.status), row.status === 'active'), Number(row.response_count), results(row)],
  active_surveys: row => [row.title, row.end_date_label, badge(`${row.days_left} day${Number(row.days_left) === 1 ? '' : 's'}`, Number(row.days_left) > 3), Number(row.response_count), results(row)],
  total_residents: row => [...resident(row), account(row)],
  total_responses: row => [row.title, row.resident_name || 'Removed resident', row.submitted_at_label],
  staff_accounts: row => [row.full_name, row.username, badge(ucfirst(row.role), row.role === 'admin'), account(row), row.created_at_label],
  deactivated_residents: resident,
  deactivated_staff: row => [row.full_name, row.username, ucfirst(row.role), row.created_at_label],
  recent_logins: row => [row.person, <span key="type" className={`badge ${row.type_label.badge}`}>{row.type_label.text}</span>, row.login_time_label],
}
