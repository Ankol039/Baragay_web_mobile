import { Navigate } from 'react-router-dom'
import usePageTitle from '../../hooks/usePageTitle.js'
import useRequestQueue from '../../hooks/useRequestQueue.js'
import PageHead from '../../components/common/PageHead.jsx'
import Alert from '../../components/common/Alert.jsx'
import Modal from '../../components/common/Modal.jsx'
import ArchivedAccountsTable from '../../components/requests/ArchivedAccountsTable.jsx'

export default function DeletedAccounts() {
  usePageTitle('Deleted Accounts')
  const queue = useRequestQueue('/staff/deleted-accounts')
  const { data, dialog } = queue
  if (queue.redirect) return <Navigate to={queue.redirect} replace />
  return <>
    <PageHead title="Deleted Accounts" subtitle="Residents and staff that have been deleted. Restoring puts an account back with its records intact." />
    {queue.message && <Alert type="success">{queue.message}</Alert>}{queue.error && !dialog && <Alert type="error">{queue.error}</Alert>}
    {data ? <>
      {!data.residents.length && !data.staff.length && <div className="card"><Alert type="info" className="alert-spaced">Nothing has been deleted. When a resident or staff account is deleted it lands here first, so it can always be brought back.</Alert></div>}
      {['residents', 'staff'].map(kind => <ArchivedAccountsTable key={kind} kind={kind} rows={data[kind]} queue={queue} />)}
    </> : !queue.error && <p role="status">Loading…</p>}
    <Modal id="purge-modal" title="Delete Permanently" narrow open={!!dialog} onClose={queue.close} beforeClose={() => !queue.busy} icon={<div className="modal-icon-warning">!</div>}>
      <p className="modal-text" id="purge-target">{dialog?.target}</p><Alert type="error">{dialog?.extra}</Alert>
      <p className="modal-text">This removes the record from the database for good. There is no archive behind this step and no way to undo it. Restore the account instead if you are unsure.</p>
      {queue.error && <Alert type="error">{queue.error}</Alert>}
      <form onSubmit={event => { event.preventDefault(); queue.run('/staff/deleted-account/purge', { kind: dialog.kind, id: String(dialog.id) }) }}>
        <div className="modal-form-actions"><button type="button" className="btn btn-secondary" data-modal-close="" disabled={queue.busy}>Cancel</button>
          <button type="submit" className="btn btn-danger" disabled={queue.busy}>Delete Permanently</button></div>
      </form>
    </Modal>
  </>
}
