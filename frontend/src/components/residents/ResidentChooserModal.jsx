import PropTypes from 'prop-types'
import { records } from '../../propTypes.js'
import { useState } from 'react'
import Modal from '../common/Modal.jsx'

export default function ResidentChooserModal({ residents, onClose, onSelect, busy }) {
  const [id, setId] = useState('')
  return <Modal id="edit-resident-chooser-modal" title="Edit Resident" open onClose={onClose} beforeClose={() => !busy}>
    <p className="form-note"><span className="req">*</span> Required field. <strong>Note:</strong> Choose a resident ID first, then the edit form will open in a separate popup.</p>
    <div className="form-section">
      <label htmlFor="edit-resident-select">Resident ID</label>
      <select id="edit-resident-select" name="edit_resident_select" value={id} onChange={event => setId(event.target.value)}>
        <option value="">Select resident ID</option>
        {residents.map(row => <option key={row.resident_id} value={row.resident_id}>{row.resident_number} - {row.full_name}</option>)}
      </select>
      <button type="button" className="btn btn-secondary" id="load-edit-resident-btn" disabled={busy}
        onClick={() => id ? onSelect(id) : window.alert('Please choose a resident ID first.')}>Show Edit Form</button>
    </div>
  </Modal>
}

if (import.meta.env.DEV) {
  ResidentChooserModal.propTypes = {
    residents: records.isRequired,
    onClose: PropTypes.func,
    onSelect: PropTypes.func.isRequired,
    busy: PropTypes.bool,
  }
}
