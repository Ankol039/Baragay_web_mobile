import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import MetricCell from '../common/MetricCell.jsx'

const stat = view => `/staff/stat-detail?view=${view}`
function Strip({ items }) {
  return <div className="db-strip">{items.map(([label, value, foot, to]) => <MetricCell key={label} label={label} value={value} foot={foot} to={to} />)}</div>
}
export default function DashboardMetrics({ data: d }) {
  return <Strip items={[
    ['Total Surveys', d.total_surveys, `${d.inactive_surveys} inactive`, stat('total_surveys')],
    ['Open for Answers', d.active_surveys, `${d.closed_surveys} past closing date`, stat('active_surveys')],
    ['Registered Residents', d.total_residents, `${d.new_residents_30} added in 30 days`, stat('total_residents')],
    ['Survey Responses', d.total_responses, <><span className={`db-delta is-${d.resp_dir}`}>{d.resp_delta}</span>{' '}vs previous 7 days</>, stat('total_responses')],
    ['Pending Requests', d.pending_address_requests, 'Address changes awaiting review', '/staff/address-requests'],
  ]} />
}
export function AdminMetrics({ data: d }) {
  return <Strip items={[
    ['Staff Accounts', d.total_staff, 'Including administrators', stat('staff_accounts')],
    ['Deactivated Residents', d.deactivated_residents, 'Cannot sign in', stat('deactivated_residents')],
    ['Deactivated Staff', d.deactivated_staff, 'Cannot sign in', stat('deactivated_staff')],
    ['Deletion Requests', d.pending_deletion_requests, 'Waiting on your decision', '/staff/deletion-requests'],
  ]} />
}

if (import.meta.env.DEV) {
  Strip.propTypes = {
    items: PropTypes.array.isRequired,
  }
  DashboardMetrics.propTypes = {
    data: record.isRequired,
  }
  AdminMetrics.propTypes = {
    data: record.isRequired,
  }
}
