import PropTypes from 'prop-types'
import { records } from '../../propTypes.js'
import DataTable from '../common/DataTable.jsx'
import Icon from '../common/Icon.jsx'

export default function StaffAccountsTable({ rows, onAction }) {
  const button = (row, action, label, icon, color, message) => <button type="button" className={`btn-action btn-action-${color}`}
    title={label} aria-label={label} onClick={() => onAction({ row, action, message })}><Icon name={icon} /></button>
  const columns = [
    { key: 'staff_number', label: 'Staff No.' }, { key: 'username', label: 'Username' }, { key: 'display_name', label: 'Full Name' },
    { key: 'role', label: 'Role', render: row => <span className={`badge badge-role-${row.role === 'admin' ? 'admin' : 'staff'}`}>{row.role.charAt(0).toUpperCase() + row.role.slice(1)}</span> },
    { key: 'onboarding', label: 'Onboarding', render: row => <span className={`badge badge-${Number(row.is_first_login) || !Number(row.profile_completed) ? 'pending' : 'approved'}`}>
      {Number(row.is_first_login) ? 'Password not set' : !Number(row.profile_completed) ? 'Profile incomplete' : 'Complete'}</span> },
    { key: 'status', label: 'Status', render: row => <span className={`badge badge-${Number(row.is_active) ? 'active' : 'inactive'}`}>{Number(row.is_active) ? 'Active' : 'Deactivated'}</span> },
    { key: 'action', label: 'Action', render: row => row.is_me ? <span className="muted-note">(you)</span> : <div className="action-buttons">
      {button(row, 'password-reset', 'Reset password', 'lock', 'warn', `Reset the password for ${row.full_name} back to their Staff Number? They will be asked to set a new one at their next login.`)}
      {button(row, 'toggle', Number(row.is_active) ? 'Deactivate account' : 'Reactivate account', 'power', Number(row.is_active) ? 'danger' : 'success',
        Number(row.is_active) ? `Deactivate the staff account for ${row.full_name}? They will not be able to log in.` : `Reactivate the staff account for ${row.full_name}?`)}
      {button(row, 'delete', 'Delete account', 'trash', 'danger', `Delete the staff account for ${row.full_name}? It moves to Deleted Accounts, where you can restore it.`)}
    </div> },
  ]
  return <DataTable id="staff-accounts-table" columns={columns} rows={rows.map(row => ({ ...row, className: Number(row.is_active) ? '' : 'row-inactive' }))} rowKey="staff_id"
    searchId="staff-account-search" searchPlaceholder="Search staff accounts..." searchLabel="Search staff accounts by name or staff number" />
}

if (import.meta.env.DEV) {
  StaffAccountsTable.propTypes = {
    rows: records.isRequired,
    onAction: PropTypes.func.isRequired,
  }
}
