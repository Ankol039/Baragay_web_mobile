import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import { useRef, useState } from 'react'
import { saveStaffProfile } from '../../services/accountsService.js'
import AddressFields from '../profile/AddressFields.jsx'
import { ageLabel } from '../residents/residentForm.js'

export default function StaffProfileForm({ data, onSaved, onError }) {
  const { account, pending_request, onboarding, today } = data
  const [values, setValues] = useState(() => Object.fromEntries([...Object.keys(account), 'reason'].map(key => [key, account[key] ?? ''])))
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  function change(key, value) { setValues(old => ({ ...old, [key]: value })) }
  const field = (key, label, placeholder, props = {}, hint) => <div><label htmlFor={key}>{label}{props.required && <> <span className="req">*</span></>}</label>
    <input type="text" id={key} name={key} value={values[key]} placeholder={placeholder} onChange={event => change(key, event.target.value)} {...props} />
    {hint && <small className="field-hint">{hint}</small>}</div>
  async function submit(event) {
    event.preventDefault(); if (pending.current) return
    pending.current = true; setBusy(true); onError('')
    const keys = ['contact_number', 'email', 'birthdate', 'gender', 'license_number', 'emergency_contact_name', 'emergency_contact_number', 'reason', ...(!pending_request ? Object.keys(data.address_fields) : [])]
    try { await onSaved(await saveStaffProfile(Object.fromEntries(keys.map(key => [key, values[key]])))) }
    catch (failure) { onError(failure.message) }
    finally { pending.current = false; setBusy(false) }
  }
  return <div className="card card-form"><form onSubmit={submit}>
    <h3 className="card-head-title">Your details</h3><div className="grid-2">
      {field('contact_number', 'Contact Number', '09XX XXX XXXX', { required: true })}
      {field('email', 'Email Address', 'e.g. juandelacruz@gmail.com', { type: 'email' })}
      {field('birthdate', 'Birthdate', undefined, { type: 'date', max: today })}
      <div><label htmlFor="age_display">Age</label><input type="text" id="age_display" className="field-readonly" readOnly tabIndex={-1} placeholder="Select a birthdate" value={ageLabel(values.birthdate)} /><small className="field-hint">Worked out from your birthdate.</small></div>
      <div><label htmlFor="gender">Gender</label><select id="gender" name="gender" value={values.gender} onChange={event => change('gender', event.target.value)}><option value="">Select</option>{Object.entries(data.genders).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></div>
      {field('license_number', 'License Number', 'PRC or CSE number, if you have one', { maxLength: 50 }, 'Optional. Leave this blank if it does not apply to you.')}
    </div>
    <h3 className="card-head-title">Permanent address</h3>
    {pending_request ? <>
      <div className="alert alert-info"><strong>Change awaiting the administrator.</strong><br />{`You asked to change this to: ${pending_request.address ?? ''}`}<br />{`Submitted ${pending_request.submitted_at}. Your address on file stays as it is until the request is reviewed.`}</div>
      <dl className="credential-slip"><dt>Address on file</dt><dd>{account.address || 'N/A'}</dd></dl>
    </> : <>
      <p className="form-note">{onboarding ? 'Entered in parts so a later correction can name the one line that changed.' : 'Changing any part of this sends a request to the administrator. Your address on file stays as it is until they approve it.'}</p>
      <AddressFields spec={data.address_fields} values={values} onChange={change} registration />
      {!onboarding && <><label htmlFor="reason">Reason for the address change</label><input type="text" id="reason" name="reason" maxLength={255} placeholder="Moved to a new household, corrected a misspelling" value={values.reason} onChange={event => change('reason', event.target.value)} /><small className="field-hint">Only needed if you actually change the address. The administrator sees this.</small></>}
    </>}
    <h3 className="card-head-title">Emergency contact</h3><div className="grid-2">
      {field('emergency_contact_name', 'Contact Name', 'Who should we call?', { maxLength: 100 })}
      {field('emergency_contact_number', 'Contact Number', '09XX XXX XXXX', { maxLength: 20 })}
    </div><button type="submit" className="btn-wide" disabled={busy}>{onboarding ? 'Finish Setup' : 'Save Changes'}</button>
  </form></div>
}

if (import.meta.env.DEV) {
  StaffProfileForm.propTypes = {
    data: record.isRequired,
    onSaved: PropTypes.func.isRequired,
    onError: PropTypes.func.isRequired,
  }
}
