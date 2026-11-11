import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import { useState } from 'react'
import Modal from '../common/Modal.jsx'

export default function RequestDeletionModal({ resident, onClose, onSubmit, busy }) {
  const [reason, setReason] = useState('')
  return <Modal id="request-delete-modal" title="Request Deletion" narrow open onClose={onClose} beforeClose={() => !busy}>
    <p className="modal-text" id="request-delete-target">Ask the administrator to delete {resident.full_name} ({resident.resident_number}).</p>
    <div className="alert alert-info">Nothing is removed yet. An administrator reviews the request and decides. If you only need to block this resident from logging in, deactivate the account instead — that keeps their survey responses.</div>
    <form method="POST" onSubmit={event => { event.preventDefault(); onSubmit(reason) }}>
      <input type="hidden" name="request_delete" value="1" /><input type="hidden" name="resident_id" value={resident.resident_id} />
      <label htmlFor="reason">Reason <span className="req">*</span></label>
      <input type="text" id="reason" name="reason" required maxLength={255} placeholder="Duplicate record, moved out of the barangay, deceased" value={reason} onChange={event => setReason(event.target.value)} />
      <small className="field-hint">The administrator sees this, so be specific.</small>
      <div className="modal-form-actions"><button type="button" className="btn btn-secondary" data-modal-close="" disabled={busy}>Cancel</button>
        <button type="submit" disabled={busy}>Send Request</button></div>
    </form>
  </Modal>
}

if (import.meta.env.DEV) {
  RequestDeletionModal.propTypes = {
    resident: record.isRequired,
    onClose: PropTypes.func,
    onSubmit: PropTypes.func.isRequired,
    busy: PropTypes.bool,
  }
}
