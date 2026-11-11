import { queue, record } from '../../propTypes.js'
import { Link } from 'react-router-dom'
import Icon from '../common/Icon.jsx'
import RequestCard, { RequestStatus } from './RequestCard.jsx'
import { ReviewButtons } from './ReviewModal.jsx'

export default function DeletionRequestTable({ data, queue }) {
  return <RequestCard title="Requests" count={data.requests.length} pending={data.requests.filter(r => r.status === 'pending').length}>
    {!data.requests.length ? <div className="alert alert-info alert-spaced">No deletion requests yet. Staff raise one from the Residents page when a record needs to be removed rather than deactivated.</div> :
      <table className="table-spaced"><thead><tr>{['Resident No.', 'Name', 'Reason', 'Requested by', 'Requested', 'Status', 'Action'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>
        {data.requests.map(r => <tr key={r.request_id} data-deletion-request-id={r.request_id}>
          <td>{r.resident_number}</td><td>{r.resident_name}</td><td>{r.reason}</td><td>{r.requested_by_name}</td><td>{r.requested_at}</td>
          <td><RequestStatus status={r.status} />{r.status === 'pending' ? <div className="muted-note">Waiting for an administrator.</div> : <>
            {r.reviewed_by_name && <div className="muted-note">{r.status === 'approved' ? 'Approved' : 'Rejected'} by {r.reviewed_by_name}{r.reviewed_at && ` · ${r.reviewed_at}`}</div>}
            {r.review_comment && <div className="muted-note"><strong>Administrator&apos;s note:</strong> {r.review_comment}</div>}
          </>}</td>
          <td>{r.status === 'pending' && data.is_admin ? <ReviewButtons kind="deletion" request={r} onOpen={queue.open} busy={queue.busy} /> :
            r.status === 'approved' && !r.was_restored && r.currently_deleted && data.is_admin ? <Link className="btn-action btn-action-primary has-label" to="/staff/deleted-accounts"><Icon name="switch" />In Deleted Accounts</Link> :
              <span className="muted-note">{r.status === 'pending' ? 'Awaiting admin' : r.status === 'rejected' ? 'Resident kept' : r.was_restored ? 'Account restored' : r.currently_deleted ? 'Moved to Deleted Accounts' : 'Record removed'}</span>}</td>
        </tr>)}
      </tbody></table>}
  </RequestCard>
}

if (import.meta.env.DEV) {
  DeletionRequestTable.propTypes = {
    data: record.isRequired,
    queue: queue.isRequired,
  }
}
