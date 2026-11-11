import PropTypes from 'prop-types'
import { records } from '../../propTypes.js'
import DataTable from '../common/DataTable.jsx'
import ResidentActions from './ResidentActions.jsx'

const filters = [{ value: 'all', label: 'All' }, { value: 'permanent', label: 'Permanent' }, { value: 'temporary', label: 'Temporary' },
  { value: 'pending-login', label: 'Pending Login' }, { value: 'deactivated', label: 'Deactivated' }]
export default function ResidentTable({ residents, canDelete, onEdit, onAction, onRequest }) {
  const columns = [
    { key: 'resident_number', label: 'Resident No.' }, { key: 'full_name', label: 'Name' }, { key: 'gender_label', label: 'Gender' }, { key: 'age', label: 'Age' },
    { key: 'category_label', label: 'Category', render: row => <>{row.category_label}{row.category_reference && <><br /><small className="muted-note mono">{row.category_reference}</small></>}</> },
    { key: 'contact_number', label: 'Contact', render: row => row.contact_number || 'N/A' }, { key: 'address', label: 'Address', render: row => row.address || 'N/A' },
    { key: 'residency_status', label: 'Residency Status', render: row => <span className={`badge badge-${row.residency_status}`}>{row.residency_status === 'temporary' ? 'Temporary' : 'Permanent'}</span> },
    { key: 'account', label: 'Account', render: row => <span className={`badge badge-${!row.is_active ? 'inactive' : row.is_first_login ? 'pending' : 'active'}`}>{!row.is_active ? 'Deactivated' : row.is_first_login ? 'First Login Pending' : 'Active'}</span> },
    { key: 'actions', label: 'Actions', render: row => <ResidentActions row={row} canDelete={canDelete} onEdit={onEdit} onAction={onAction} onRequest={onRequest} /> },
  ]
  return <DataTable id="residents-table" columns={columns} rows={residents.map(row => ({ ...row, className: 'resident-row' }))} rowKey="resident_id"
    filters={filters} searchId="resident-search" searchPlaceholder="Search Resident..." searchLabel="Search residents by name or resident number"
    emptyMessage="No residents match your search or filter." />
}

if (import.meta.env.DEV) {
  ResidentTable.propTypes = {
    residents: records.isRequired,
    canDelete: PropTypes.bool.isRequired,
    onEdit: PropTypes.func.isRequired,
    onAction: PropTypes.func.isRequired,
    onRequest: PropTypes.func.isRequired,
  }
}
