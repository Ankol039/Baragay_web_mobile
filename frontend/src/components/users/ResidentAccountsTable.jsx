import PropTypes from 'prop-types'
import { records } from '../../propTypes.js'
import DataTable from '../common/DataTable.jsx'
import Icon from '../common/Icon.jsx'

export default function ResidentAccountsTable({ rows, onAction }) {
  const columns = [
    { key: 'resident_number', label: 'Resident No.' }, { key: 'full_name', label: 'Name' },
    { key: 'residency', label: 'Residency', render: row => <span className={`badge badge-${row.residency_status}`}>{row.residency_status.charAt(0).toUpperCase() + row.residency_status.slice(1)}</span> },
    { key: 'status', label: 'Status', render: row => <span className={`badge badge-${Number(row.is_active) ? 'active' : 'inactive'}`}>{Number(row.is_active) ? 'Active' : 'Deactivated'}</span> },
    { key: 'action', label: 'Action', render: row => <button type="button" className={`btn-action btn-action-${Number(row.is_active) ? 'danger' : 'success'}`}
      title={Number(row.is_active) ? 'Deactivate account' : 'Activate account'} onClick={() => onAction({ row, action: 'resident-toggle', message: Number(row.is_active)
        ? `Deactivate the account for ${row.full_name}? They will not be able to log in or answer surveys.` : `Reactivate the account for ${row.full_name}?` })}><Icon name="power" /></button> },
  ]
  return <DataTable id="resident-accounts-table" columns={columns} rows={rows.map(row => ({ ...row, className: Number(row.is_active) ? '' : 'row-inactive' }))} rowKey="resident_id"
    searchId="resident-account-search" searchPlaceholder="Search resident accounts..." searchLabel="Search resident accounts by name or resident number" emptyMessage="No resident accounts match your search." />
}

if (import.meta.env.DEV) {
  ResidentAccountsTable.propTypes = {
    rows: records.isRequired,
    onAction: PropTypes.func.isRequired,
  }
}
