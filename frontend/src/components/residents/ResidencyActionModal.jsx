import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from '../common/Modal.jsx'

export default function ResidencyActionModal({ detail, onClose, onSubmit, busy }) {
  const [reason, setReason] = useState('')
  const { resident, restore_address: restore } = detail
  const promote = resident.residency_status === 'temporary'
  const kind = promote ? 'promote' : 'revert'
  const name = `${resident.first_name || ''} ${resident.last_name || ''}`.trim()
  return <Modal id={`${kind}-resident-modal`} title={promote ? 'Make Permanent Resident' : 'Revert to Temporary Resident'} open onClose={onClose} beforeClose={() => !busy}>
    <p className="modal-text" id={`${kind}-target`}>{promote ? `Make ${name} a permanent resident.` : `Return ${name} to temporary resident status.`}</p>
    {promote ? <div className="alert alert-info"><strong>What this changes:</strong> the address they have been staying at becomes their permanent address on record. The address currently on file is moved to <Link to="/staff/residency-records">Residency Records</Link>, where it stays available. Their profile stops showing a separate temporary address.
      <br /><br />This can be undone. If the claim is later disproved, revert them to temporary and both addresses go back exactly as they were.</div>
      : <div className="alert alert-warning">Use this when a permanent record was granted on information that turned out to be false. The address archived at the time of the promotion is restored as their permanent address, and the address they are living at now goes back to being their temporary address, which reappears in their profile.</div>}
    <table className="table-compact" style={{ marginBottom: 18 }}><tbody>
      <tr><th style={{ width: '44%' }}>{promote ? 'Address to be archived' : 'Current permanent address'}</th><td id={promote ? 'promote-old-address' : 'revert-current-address'}>{resident.address || 'None on file'}</td></tr>
      <tr><th>{promote ? 'Becomes their permanent address' : 'Will be restored to'}</th><td id={promote ? 'promote-new-address' : 'revert-restore-address'}>{promote ? resident.temporary_address || 'None on file' : restore || 'No archived address - this resident was registered as permanent, so staff will need to enter their permanent address afterwards.'}</td></tr>
      {promote && <tr><th>Length of stay</th><td id="promote-duration">Checked against the 6-month minimum when you confirm.</td></tr>}
    </tbody></table>
    <form method="POST" onSubmit={event => { event.preventDefault(); onSubmit(kind, reason) }}>
      <input type="hidden" name={`${kind}_resident`} value="1" /><input type="hidden" name="resident_id" value={resident.resident_id} />
      <label htmlFor={`${kind}_reason`}>{promote ? 'Note for the record' : <>Reason <span className="req">*</span></>}</label>
      <input type="text" id={`${kind}_reason`} name="reason" required={!promote} maxLength={255} value={reason} onChange={event => setReason(event.target.value)}
        placeholder={promote ? 'Presented barangay clearance and lease dated Jan 2026' : 'Lease document found to be falsified, confirmed by purok leader'} />
      <small className="field-hint">{promote ? 'Optional, but it is what a future admin will read when reviewing this change.' : "Required. This is kept permanently on the resident's record."}</small>
      <div className="modal-form-actions"><button type="button" className="btn btn-secondary" data-modal-close="" disabled={busy}>Cancel</button>
        <button type="submit" className={promote ? undefined : 'btn-danger'} disabled={busy}>{promote ? 'Make Permanent' : 'Revert to Temporary'}</button></div>
    </form>
  </Modal>
}

if (import.meta.env.DEV) {
  ResidencyActionModal.propTypes = {
    detail: record.isRequired,
    onClose: PropTypes.func,
    onSubmit: PropTypes.func.isRequired,
    busy: PropTypes.bool,
  }
}
