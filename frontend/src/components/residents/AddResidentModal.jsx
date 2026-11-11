import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { createResident } from '../../services/accountsService.js'
import Modal from '../common/Modal.jsx'
import Alert from '../common/Alert.jsx'
import FamilyFields from '../profile/FamilyFields.jsx'
import ResidentAddressFields from './ResidentAddressFields.jsx'
import ResidentPersonalFields from './ResidentPersonalFields.jsx'
import { emptyResident } from './residentForm.js'

export default function AddResidentModal({ data, open, onClose, onAdded }) {
  const [values, setValues] = useState(() => emptyResident(data.fields))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [redirect, setRedirect] = useState(null)
  function reset() { setValues(emptyResident(data.fields)); setError('') }
  function change(key, value) {
    setValues(previous => ({ ...previous, [key]: value, ...(key === 'special_category' && value === 'none' ? { category_reference: '' } : {}),
      ...(key === 'courtesy_title' && value !== 'Others' ? { courtesy_title_other: '' } : {}) }))
  }
  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const result = await createResident(values)
      if (!result.data) { setRedirect(result.redirect); return }
      onAdded(result)
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  if (redirect) return <Navigate to={redirect} replace />
  return <Modal id="add-resident-modal" title="Add Resident" wide open={open} onClose={onClose} onReset={reset} beforeClose={() => !busy}>
    {error && <Alert type="error">{error}</Alert>}
    <p className="form-note"><span className="req">*</span> Required field. <strong>Note:</strong> Resident Number is auto-generated upon submission.</p>
    <form method="POST" onSubmit={submit}>
      <input type="hidden" name="add_resident" value="1" />
      <ResidentPersonalFields fields={data.fields} values={values} onChange={change} today={data.today} />
      <ResidentAddressFields fields={data.fields} values={values} onChange={change} />
      <FamilyFields fields={data.fields} values={values} onChange={change} idPrefix="add" />{' '}
      <button type="submit" disabled={busy}>Add Resident</button>{' '}
      <button type="button" className="btn-secondary" data-modal-close="" disabled={busy}>Cancel</button>
    </form>
  </Modal>
}

if (import.meta.env.DEV) {
  AddResidentModal.propTypes = {
    data: record.isRequired,
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func,
    onAdded: PropTypes.func.isRequired,
  }
}
