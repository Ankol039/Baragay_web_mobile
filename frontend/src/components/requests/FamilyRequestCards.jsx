import { queue, records } from '../../propTypes.js'
import DetailsTable from '../common/DetailsTable.jsx'
import RequestCard, { RequestStatus } from './RequestCard.jsx'
import ReviewModal from './ReviewModal.jsx'

export default function FamilyRequestCards({ requests, queue }) {
  return <RequestCard title="Family & Household Requests" count={requests.length}>
    {!requests.length && <div className="alert alert-info">No family or household changes have been requested.</div>}
    {requests.map(r => <div className="person-row" key={r.request_id} data-family-request-id={r.request_id}>
      <div className="person-row-head"><span className="person-row-title">{`${r.name} · ${r.resident_number}`}</span><RequestStatus status={r.status} /></div>
      <p className="muted-note"><strong>Reason given:</strong>{` ${r.reason ?? ''}`}<br />{`Requested ${r.requested_at}.`}
        {r.status !== 'pending' && r.reviewed_by_name && <><br />{r.status === 'approved' ? 'Approved' : 'Rejected'} by {r.reviewed_by_name}{r.reviewed_at && ` · ${r.reviewed_at}`}
          {r.review_comment?.trim() && <><br /><strong>Note:</strong> {r.review_comment}</>}</>}
      </p>
      <DetailsTable rows={r.details} />
      {r.status === 'pending' && <ReviewModal inline kind="family" request={r} onReview={queue.review} busy={queue.busy} />}
    </div>)}
  </RequestCard>
}

if (import.meta.env.DEV) {
  FamilyRequestCards.propTypes = {
    requests: records.isRequired,
    queue: queue.isRequired,
  }
}
