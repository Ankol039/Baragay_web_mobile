import PropTypes from 'prop-types'
import { queue, record, records } from '../../propTypes.js'
import Icon from '../common/Icon.jsx'

const capitalize = value => value ? value.charAt(0).toUpperCase() + value.slice(1) : ''
function DeletionDetails({ row }) {
  return <>{row.deleted_at}{row.deleted_by_name && <div className="muted-note">by {row.deleted_by_name}</div>}{row.delete_reason && <div className="muted-note">{row.delete_reason}</div>}</>
}
export default function ArchivedAccountsTable({ kind, rows, queue }) {
  if (!rows.length) return null
  const resident = kind === 'residents'
  return <div className={`card${resident ? '' : ' section-spaced'}`}>
    <div className="card-head"><h3 className="card-head-title">{`${resident ? 'Deleted Residents' : 'Deleted Staff Accounts'} (${rows.length})`}</h3></div>
    <table className="table-spaced"><thead><tr>{(resident ? ['Resident No.', 'Name', 'Residency', 'Responses Held', 'Deleted', 'Action'] : ['Staff No.', 'Name', 'Role', 'Deleted', 'Action']).map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>
      {rows.map(row => {
        const id = resident ? row.resident_id : row.staff_id
        const number = resident ? row.resident_number : row.staff_number
        const target = { ...row, kind, id, target: `${row.name} (${number || row.username})`, extra: resident
          ? `${row.response_count} survey response${Number(row.response_count) === 1 ? '' : 's'} will also be destroyed.` : 'Their login and employment record will be destroyed.' }
        return <tr key={id} data-archive-id={id} data-kind={kind}>
          <td>{number || '—'}</td><td>{row.name}{!resident && <div className="muted-note">{row.username}</div>}</td>
          <td><span className={`badge badge-${resident ? (row.residency_status === 'temporary' ? 'temporary' : 'permanent') : `role-${row.role.toLowerCase()}`}`}>{capitalize(resident ? row.residency_status || 'permanent' : row.role)}</span></td>
          {resident && <td>{row.response_count}</td>}<td><DeletionDetails row={row} /></td>
          <td><div className="action-buttons">
            <form className="inline-select-form" onSubmit={event => { event.preventDefault(); queue.run('/staff/deleted-account/restore', { kind, id: String(id) }) }}>
              <button type="submit" className="btn-action btn-action-primary has-label" title={`Restore this ${resident ? 'resident' : 'staff account'}`} disabled={queue.busy}><Icon name="switch" />Restore</button>
            </form>
            <button type="button" className="btn-action btn-action-danger has-label" title="Delete permanently" disabled={queue.busy} onClick={() => queue.open(target)}><Icon name="trash" />Delete Forever</button>
          </div></td>
        </tr>
      })}
    </tbody></table>
  </div>
}

if (import.meta.env.DEV) {
  DeletionDetails.propTypes = {
    row: record.isRequired,
  }
  ArchivedAccountsTable.propTypes = {
    kind: PropTypes.oneOf(['residents', 'staff']).isRequired,
    rows: records.isRequired,
    queue: queue.isRequired,
  }
}
