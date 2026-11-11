import { queue, record } from '../../propTypes.js'
import RequestCard, { RequestStatus } from './RequestCard.jsx'
import ReviewModal, { ReviewButtons } from './ReviewModal.jsx'

export default function AddressRequestTables({ data, queue }) {
  return <>
    <RequestCard title="Resident Requests" count={data.resident.length}>
      <table><thead><tr>{['Resident', 'Current Address', 'Requested Address', 'Status', 'Submitted', ''].map((label, i) => <th key={i}>{label}</th>)}</tr></thead><tbody>
        {!data.resident.length && <tr><td colSpan={6} className="empty-state">No address requests submitted yet.</td></tr>}
        {data.resident.map(r => <tr key={r.request_id} data-request-id={r.request_id}>
          <td>{r.name}</td><td>{r.previous_address || 'N/A'}</td><td>{r.address || <span className="muted-note">—</span>}
            {r.birthdate && <div className="muted-note">Birthdate correction: {r.birthdate}</div>}</td>
          <td><RequestStatus status={r.status} /></td><td>{r.submitted_at}</td>
          <td>{r.status === 'pending' && <ReviewModal inline kind="resident" request={r} busy={queue.busy} onReview={queue.review} />}</td>
        </tr>)}
      </tbody></table>
    </RequestCard>
    {data.is_admin && <RequestCard title="Staff Requests" count={data.staff.length} pending={data.staff.filter(r => r.status === 'pending').length}>
      {!data.staff.length ? <div className="alert alert-info alert-spaced">No staff address changes have been requested.</div> :
        <table><thead><tr>{['Staff', 'Current Address', 'Requested Address', 'Reason', 'Status', 'Submitted', ''].map((label, i) => <th key={i}>{label}</th>)}</tr></thead><tbody>
          {data.staff.map(r => <tr key={r.request_id} data-staff-request-id={r.request_id}>
            <td>{r.staff_name}<div className="muted-note">{r.staff_number}</div></td><td>{r.previous_address || 'N/A'}</td><td>{r.address}</td><td>{r.reason || '—'}</td>
            <td><RequestStatus status={r.status} />{r.status !== 'pending' && <>{r.review_comment && <div className="muted-note">{r.review_comment}</div>}{r.reviewed_by_name && <div className="muted-note">by {r.reviewed_by_name}</div>}</>}</td>
            <td>{r.submitted_at}</td><td>{r.status === 'pending' ? <ReviewButtons kind="staff" request={r} busy={queue.busy} onOpen={queue.open} /> : <span className="muted-note">Closed</span>}</td>
          </tr>)}
        </tbody></table>}
    </RequestCard>}
  </>
}

if (import.meta.env.DEV) {
  AddressRequestTables.propTypes = {
    data: record.isRequired,
    queue: queue.isRequired,
  }
}
