import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import Icon from '../common/Icon.jsx'

export default function ResidentActions({ row, canDelete, onEdit, onAction, onRequest }) {
  const action = (kind, label, icon, className, message) => <button type="button" className={`btn-action ${className}`}
    title={label} aria-label={label} onClick={() => onAction(kind, row, message)}><Icon name={icon} /></button>
  return <div className="action-buttons">
    <button type="button" className="btn-action btn-action-primary edit-resident-row" title="Edit resident" aria-label="Edit resident" onClick={() => onEdit(row.resident_id)}><Icon name="edit" /></button>
    {action('password-reset', 'Reset password', 'lock', 'btn-action-warn', "Reset this resident's password to their Resident Number?")}
    {action('toggle', row.is_active ? 'Deactivate account' : 'Reactivate account', 'power', row.is_active ? 'btn-action-warn' : 'btn-action-success',
      row.is_active ? `Deactivate ${row.full_name}? They will not be able to log in, but their survey history is kept.` : `Reactivate ${row.full_name}?`)}
    {canDelete ? action('delete', 'Delete resident', 'trash', 'btn-action-danger', `Delete ${row.full_name}? Their submitted survey responses will also be deleted. This cannot be undone.`)
      : row.pending_delete ? <span className="btn-action btn-action-muted" title="Deletion request awaiting the administrator"><Icon name="clock" /></span>
        : <button type="button" className="btn-action btn-action-danger" title="Request deletion" aria-label="Request deletion" onClick={() => onRequest(row)}><Icon name="trash" /></button>}
  </div>
}

if (import.meta.env.DEV) {
  ResidentActions.propTypes = {
    row: record.isRequired,
    canDelete: PropTypes.bool.isRequired,
    onEdit: PropTypes.func.isRequired,
    onAction: PropTypes.func.isRequired,
    onRequest: PropTypes.func.isRequired,
  }
}
