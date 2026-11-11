import { useContext, useState } from 'react'
import { Navigate } from 'react-router-dom'
import useServiceData from '../../hooks/useServiceData.js'
import usePageTitle from '../../hooks/usePageTitle.js'
import { listResidents } from '../../services/accountsService.js'
import PageHead from '../../components/common/PageHead.jsx'
import Alert from '../../components/common/Alert.jsx'
import Modal from '../../components/common/Modal.jsx'
import ResidentTable from '../../components/residents/ResidentTable.jsx'
import ConfirmModal from '../../components/common/ConfirmModal.jsx'
import ResidentChooserModal from '../../components/residents/ResidentChooserModal.jsx'
import EditResidentModal from '../../components/residents/EditResidentModal.jsx'
import RequestDeletionModal from '../../components/residents/RequestDeletionModal.jsx'
import ResidencyActionModal from '../../components/residents/ResidencyActionModal.jsx'
import useResidentActions from '../../hooks/useResidentActions.js'
import { AuthContext } from '../../context/authContext.js'
import AddResidentModal from '../../components/residents/AddResidentModal.jsx'

export default function ResidentManagement() {
  usePageTitle('Resident Management')
  const { data, error, redirect } = useServiceData(listResidents)
  const [latest, setLatest] = useState(null)
  const [adding, setAdding] = useState(false)
  const [success, setSuccess] = useState(null)
  const [failure, setFailure] = useState('')
  const auth = useContext(AuthContext)
  const current = latest || data
  const actions = useResidentActions(saved, setFailure)
  const dialog = actions.dialog
  async function saved(result) {
    actions.setDialog(null)
    setAdding(false); setFailure('')
    try {
      const response = await listResidents()
      if (response.data) setLatest(response.data)
      await auth?.refresh()
    } catch (err) { setFailure(err.message) }
    finally { setSuccess(result.message ? result : null) }
  }
  if (redirect || actions.redirect) return <Navigate to={redirect || actions.redirect} replace />
  return <>
    <PageHead title="Residents" subtitle="View and manage the residents registered with the health center." />
    <div className="card">
      <div className="card-head">
        <h2 className="card-head-title">{`Registered Residents (${current?.residents.length ?? 0})`}</h2>
        <div className="btn-pair"><button type="button" className="btn" disabled={!current} onClick={() => setAdding(true)}>+ Add Resident</button>{' '}
          <button type="button" className="btn btn-accent" disabled={!current} onClick={() => actions.setDialog({ type: 'chooser' })}>Edit Resident</button></div>
      </div>
      {(error || failure) && <Alert type="error" className="alert-spaced">{error || failure}</Alert>}
      {current ? <ResidentTable residents={current.residents} canDelete={current.can_delete} onEdit={actions.edit}
        onAction={(action, resident, message) => actions.setDialog({ type: 'confirm', action, resident, message })}
        onRequest={resident => actions.setDialog({ type: 'request', resident })} /> : !error && <p role="status">Loading…</p>}
    </div>
    {current && <AddResidentModal data={current} open={adding} onClose={() => setAdding(false)} onAdded={saved} />}
    {current && dialog?.type === 'chooser' && <ResidentChooserModal residents={current.residents} onClose={actions.close} onSelect={actions.edit} busy={actions.busy} />}
    {current && dialog?.type === 'edit' && <EditResidentModal key={dialog.detail.resident.resident_id} data={current} detail={dialog.detail} onClose={actions.close} onSaved={saved}
      onSwitch={() => actions.setDialog({ ...dialog, type: 'residency' })} />}
    {dialog?.type === 'request' && <RequestDeletionModal resident={dialog.resident} onClose={actions.close} busy={actions.busy}
      onSubmit={reason => actions.run('request-delete', dialog.resident, reason)} />}
    {dialog?.type === 'residency' && <ResidencyActionModal detail={dialog.detail} onClose={actions.close} busy={actions.busy}
      onSubmit={(action, reason) => actions.run(action, dialog.detail.resident, reason)} />}
    <ConfirmModal id="resident-action-confirm" open={dialog?.type === 'confirm'} message={dialog?.message} onClose={actions.close}
      onConfirm={() => actions.run(dialog.action, dialog.resident)} />
    <Modal id="resident-success-modal" title="Success" narrow open={!!success} onClose={() => setSuccess(null)}
      icon={<div className="modal-icon-success">✓</div>}>
      <p className="modal-text">{success?.message}<strong>{success?.data?.resident_number}</strong></p>
      <div className="modal-actions"><button type="button" className="btn" data-modal-close="">Done</button></div>
    </Modal>
  </>
}
