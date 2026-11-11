import { record } from '../../propTypes.js'
import { useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import useServiceData from '../../hooks/useServiceData.js'
import useAuth from '../../hooks/useAuth.js'
import usePageTitle from '../../hooks/usePageTitle.js'
import { listUsers, userAction } from '../../services/accountsService.js'
import PageHead from '../../components/common/PageHead.jsx'
import Alert from '../../components/common/Alert.jsx'
import Modal from '../../components/common/Modal.jsx'
import ConfirmModal from '../../components/common/ConfirmModal.jsx'
import StaffAccountsTable from '../../components/users/StaffAccountsTable.jsx'
import ResidentAccountsTable from '../../components/users/ResidentAccountsTable.jsx'
import AddStaffModal from '../../components/users/AddStaffModal.jsx'
import StaffCreatedModal from '../../components/users/StaffCreatedModal.jsx'

export default function UserManagement() {
  const result = useServiceData(listUsers)
  usePageTitle('User Management')
  if (result.redirect) return <Navigate to={result.redirect} replace />
  if (result.error) return <Alert type="error" inline>{result.error}</Alert>
  if (!result.data) return <p role="status">Loading…</p>
  return <Users initial={result.data} />
}
function Users({ initial }) {
  const [data, setData] = useState(initial), [add, setAdd] = useState(false), [slip, setSlip] = useState(null)
  const [action, setAction] = useState(null), [message, setMessage] = useState(''), [success, setSuccess] = useState(false), [error, setError] = useState('')
  const pending = useRef(false)
  const { refresh } = useAuth()
  async function reload() { setData((await listUsers()).data); await refresh() }
  async function created(result) {
    setAdd(false); setSlip(result.data.new_staff); setMessage(result.message); setError('')
    try { await reload() } catch (failure) { setError(failure.message) }
  }
  async function run() {
    if (pending.current) return
    pending.current = true; setError('')
    try {
      const result = await userAction(action.action, action.action === 'resident-toggle' ? action.row.resident_id : action.row.staff_id)
      setAction(null); setMessage(result.message); await reload(); setSuccess(!!result.message)
    } catch (failure) { setAction(null); setError(failure.message) }
    finally { pending.current = false }
  }
  return <>
    <PageHead title="User Management" subtitle={data.is_admin ? 'You can create staff accounts, deactivate any account, and delete resident records.' : 'You can deactivate resident accounts. Deleting a resident is an administrator action.'} />
    {message && <Alert key={message} type="success">{message}</Alert>}{error && <Alert key={error} type="error">{error}</Alert>}
    {data.is_admin && data.pending_deletions > 0 && <Alert type="info" inline>{`${data.pending_deletions} resident deletion ${data.pending_deletions === 1 ? 'request is' : 'requests are'} waiting for your review. `}<Link to="/staff/deletion-requests">Open Deletion Requests</Link>.</Alert>}
    {data.is_admin && <div className="card"><div className="card-head"><h3 className="card-head-title">{`Staff Accounts (${data.staff.length})`}</h3><button type="button" className="btn" onClick={() => setAdd(true)}>+ Add Staff Account</button></div><StaffAccountsTable rows={data.staff} onAction={setAction} /></div>}
    <div className="card"><div className="card-head"><h3 className="card-head-title">{`Resident Accounts (${data.residents.length})`}</h3><Link className="btn btn-outline btn-small" to="/staff/resident-management">Go to Resident Management</Link></div><ResidentAccountsTable rows={data.residents} onAction={setAction} /></div>
    {add && <AddStaffModal data={data} onClose={() => setAdd(false)} onSaved={created} />}
    {slip && <StaffCreatedModal account={slip} onClose={() => setSlip(null)} />}
    <ConfirmModal id="user-action-confirm" open={!!action} message={action?.message} onClose={() => { if (!pending.current) setAction(null) }} onConfirm={run} />
    <Modal id="user-success-modal" open={success} narrow title="Success" onClose={() => setSuccess(false)} icon={<div className="modal-icon-success">✓</div>}><p className="modal-text">{message}</p><div className="modal-actions"><button type="button" className="btn" data-modal-close="">Done</button></div></Modal>
  </>
}

if (import.meta.env.DEV) {
  Users.propTypes = {
    initial: record.isRequired,
  }
}
