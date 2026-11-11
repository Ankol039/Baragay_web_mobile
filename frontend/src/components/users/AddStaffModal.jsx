import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import { useRef, useState } from 'react'
import Modal from '../common/Modal.jsx'
import Alert from '../common/Alert.jsx'
import { createStaff } from '../../services/accountsService.js'

export default function AddStaffModal({ data, onClose, onSaved }) {
  const [values, setValues] = useState({ courtesy_title: '', courtesy_title_other: '', first_name: '', middle_name: '', last_name: '', name_extension: '', date_hired: '' })
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const pending = useRef(false)
  function change(key, value) { setValues(old => ({ ...old, [key]: value, ...(key === 'courtesy_title' && value !== 'Others' ? { courtesy_title_other: '' } : {}) })) }
  const field = (key, label, placeholder, required = false, props = {}) => <div>
    <label htmlFor={key}>{label}{required && <> <span className="req">*</span></>}</label>
    <input type="text" id={key} name={key} value={values[key]} onChange={event => change(key, event.target.value)} required={required} placeholder={placeholder} {...props} />
  </div>
  async function submit(event) {
    event.preventDefault(); if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try { await onSaved(await createStaff(values)) }
    catch (failure) { setError(failure.message) }
    finally { pending.current = false; setBusy(false) }
  }
  return <Modal id="add-staff-modal" title="Add Staff Account" open onClose={onClose} beforeClose={() => !busy}>
    {error && <Alert type="error" inline>{error}</Alert>}
    <p className="form-note"><span className="req">*</span> Required field. Enter the employment record only — the new hire fills in their own contact details and sets their own password at first login. The Staff Number is issued automatically and serves as the username, the record key, and the one-time password. All accounts created here get the <strong>Staff</strong> role.</p>
    <form onSubmit={submit}><input type="hidden" name="add_staff" value="1" /><div className="grid-2">
      <div><label htmlFor="courtesy_title">Courtesy Title</label><select id="courtesy_title" name="courtesy_title" data-title-select="" value={values.courtesy_title} onChange={event => change('courtesy_title', event.target.value)}>
        <option value="">None</option>{data.titles.map(title => <option key={title}>{title}</option>)}<option>Others</option></select></div>
      {values.courtesy_title === 'Others' && field('courtesy_title_other', 'Specify Title', 'Dr., Engr., Atty.', false, { maxLength: 20, required: true })}
      {field('first_name', 'First Name', 'e.g. Juan', true)}{field('middle_name', 'Middle Name', 'e.g. Santos')}
      {field('last_name', 'Last Name', 'e.g. Dela Cruz', true)}{field('name_extension', 'Name Extension', 'Jr., Sr., III')}
      {field('date_hired', 'Date Hired', undefined, true, { type: 'date', max: data.today })}
    </div><div className="modal-form-actions"><button type="button" className="btn btn-secondary" data-modal-close="" disabled={busy}>Cancel</button><button type="submit" disabled={busy}>Add Staff Account</button></div></form>
  </Modal>
}

if (import.meta.env.DEV) {
  AddStaffModal.propTypes = {
    data: record.isRequired,
    onClose: PropTypes.func,
    onSaved: PropTypes.func.isRequired,
  }
}
