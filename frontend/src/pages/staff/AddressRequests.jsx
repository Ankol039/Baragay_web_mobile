import { Navigate } from 'react-router-dom'
import usePageTitle from '../../hooks/usePageTitle.js'
import useRequestQueue from '../../hooks/useRequestQueue.js'
import PageHead from '../../components/common/PageHead.jsx'
import Alert from '../../components/common/Alert.jsx'
import Modal from '../../components/common/Modal.jsx'
import ReviewModal from '../../components/requests/ReviewModal.jsx'
import AddressRequestTables from '../../components/requests/AddressRequestTables.jsx'
import FamilyRequestCards from '../../components/requests/FamilyRequestCards.jsx'

export default function AddressRequests() {
  usePageTitle('Address Requests')
  const queue = useRequestQueue('/staff/address-requests')
  const { data, dialog } = queue
  if (queue.redirect) return <Navigate to={queue.redirect} replace />
  return <>
    <PageHead title="Address Requests" subtitle={data?.is_admin ? 'Review name and address changes submitted by residents and staff.' : 'Review address changes submitted by residents.'} />
    {queue.error && !dialog && <Alert type="error">{queue.error}</Alert>}
    {data ? <><AddressRequestTables data={data} queue={queue} />{data.is_admin && <FamilyRequestCards requests={data.family} queue={queue} />}</> : !queue.error && <p role="status">Loading…</p>}
    {dialog && <ReviewModal key={`${dialog.kind}-${dialog.request.request_id}-${dialog.action}`} {...dialog} busy={queue.busy} error={queue.error} onClose={queue.close} onReview={queue.review} />}
    <Modal id="address-request-success-modal" title="Success" narrow open={!!queue.message} onClose={queue.clearMessage} icon={<div className="modal-icon-success">✓</div>}>
      <p className="modal-text">{queue.message}</p><div className="modal-actions"><button type="button" className="btn" data-modal-close="">Done</button></div>
    </Modal>
  </>
}
