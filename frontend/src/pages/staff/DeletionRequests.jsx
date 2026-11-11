import { Navigate } from 'react-router-dom'
import usePageTitle from '../../hooks/usePageTitle.js'
import useRequestQueue from '../../hooks/useRequestQueue.js'
import PageHead from '../../components/common/PageHead.jsx'
import Alert from '../../components/common/Alert.jsx'
import ReviewModal from '../../components/requests/ReviewModal.jsx'
import DeletionRequestTable from '../../components/requests/DeletionRequestTable.jsx'

export default function DeletionRequests() {
  usePageTitle('Deletion Requests')
  const queue = useRequestQueue('/staff/deletion-requests')
  const { data, dialog } = queue
  if (queue.redirect) return <Navigate to={queue.redirect} replace />
  return <>
    <PageHead title="Deletion Requests" subtitle={data?.is_admin
      ? 'Approve or reject resident deletions raised by staff. Approving moves the resident to Deleted Accounts, where you can still restore them.'
      : 'Deletion requests you and other staff have raised. An administrator decides the outcome.'} />
    {queue.message && <Alert type="success">{queue.message}</Alert>}{queue.error && !dialog && <Alert type="error">{queue.error}</Alert>}
    {data ? <DeletionRequestTable data={data} queue={queue} /> : !queue.error && <p role="status">Loading…</p>}
    {dialog && <ReviewModal key={`${dialog.request.request_id}-${dialog.action}`} {...dialog} busy={queue.busy} error={queue.error} onClose={queue.close} onReview={queue.review} />}
  </>
}
