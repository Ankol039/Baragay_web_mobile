import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import Modal from '../common/Modal.jsx'
import Alert from '../common/Alert.jsx'
import useProfileForm from '../../hooks/useProfileForm.js'
import { editablePerson } from '../../config/personFields.js'
import PersonFields from './PersonFields.jsx'
import AddressFields from './AddressFields.jsx'
import { requestBirthdate, requestNameAddress } from '../../services/profileService.js'

export default function RequestChangeModal({ type, data, onClose, onSaved }) {
  const birthdate = type === 'birthdate'
  const form = useProfileForm(() => editablePerson(data.resident, data.fields.person),
    birthdate ? requestBirthdate : requestNameAddress, onSaved)
  return <Modal id={birthdate ? 'request-birthdate-modal' : 'request-change-modal'} open keepOnClose narrow={birthdate}
    title={birthdate ? 'Request Birthdate Correction' : 'Request Name / Address Change'} onClose={onClose}
    beforeClose={() => !form.busy && form.dirty.confirmDiscard()}>
    {!birthdate && data.pending_request && <Alert type="error" inline className="request-pending-warning">You already have a pending name/address request under review.</Alert>}
    {form.error && <Alert type="error" inline>{form.error}</Alert>}
    <p className="muted-note">{birthdate ? 'Your birthdate sets the age on your record and your senior-citizen eligibility, so a correction is reviewed by staff before it takes effect.'
      : 'Address changes are sent to staff for review.'}</p>
    <form className="profile-request-form" {...form.dirty.formProps} onSubmit={event => form.submit(event,
      birthdate ? { birthdate: form.values.birthdate } : form.values)}>
      {birthdate ? <>
        <label htmlFor="birthdate">Corrected Birthdate</label>
        <input type="date" id="birthdate" name="birthdate" max={data.today} value={form.values.birthdate} onChange={event => form.change('birthdate', event.target.value)} />
        <small className="field-hint">Currently on record: {data.resident.birthdate || 'not set'}.</small>
      </> : <>
        <div className="grid-2"><PersonFields spec={data.fields.person} values={form.values} onChange={form.change} idPrefix="request" identity /></div>
        <AddressFields spec={data.fields.address} values={form.values} onChange={form.change} />
        {data.resident.residency_status === 'temporary' && <>
          <h3 className="form-section-title">Temporary Address</h3>
          <p className="field-hint">This is the address the health center uses to find you. Corrections are reviewed by staff.</p>
          <AddressFields spec={data.fields.address} values={form.values} onChange={form.change} prefix="temp_" />
        </>}
      </>}
      <button type="submit" className="btn" disabled={form.busy}>{birthdate ? 'Send Request' : 'Request Name/Address Change'}</button>{' '}
      <button type="button" className="btn-secondary" data-modal-close="">Cancel</button>
    </form>
  </Modal>
}

if (import.meta.env.DEV) {
  RequestChangeModal.propTypes = {
    type: PropTypes.string.isRequired,
    data: record.isRequired,
    onClose: PropTypes.func,
    onSaved: PropTypes.func.isRequired,
  }
}
