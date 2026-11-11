import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import Modal from '../common/Modal.jsx'
import Alert from '../common/Alert.jsx'
import FamilyFields from './FamilyFields.jsx'
import useProfileForm from '../../hooks/useProfileForm.js'
import { editableFamily, familyPayload } from '../../config/personFields.js'
import { requestFamily } from '../../services/profileService.js'

export default function FamilyRequestModal({ data, onClose, onSaved }) {
  const form = useProfileForm(() => editableFamily(data.resident, data.fields.person, true), requestFamily, onSaved)
  return <Modal id="family-request-modal" open wide title="Request Family & Household Change"
    onClose={onClose} beforeClose={() => !form.busy}>
    <p className="muted-note">Correct anything below and send it to barangay staff. Nothing on your record changes until they approve it.</p>
    {form.error && <Alert type="error" inline>{form.error}</Alert>}
    {data.pending_family_request ? <Alert inline>You already have a change waiting for review, requested {data.pending_family_request.requested_at_label}. Staff will look at that one first.</Alert>
      : <form data-unsaved-warning="" onSubmit={event => form.submit(event, familyPayload(form.values, data.fields.person))}>
        <FamilyFields fields={data.fields} values={form.values} onChange={form.change} />
        <div style={{ marginTop: 14 }}>
          <label htmlFor="family_reason">Reason for the change <span className="req">*</span></label>
          <input type="text" id="family_reason" name="family_reason" required maxLength={255}
            placeholder="e.g. My spouse's surname was spelled incorrectly" value={form.values.family_reason} onChange={event => form.change('family_reason', event.target.value)} />
          <small className="field-hint">Staff read this when deciding, so keep it specific.</small>
        </div>
        <div className="modal-actions"><button type="submit" disabled={form.busy}>Send Request</button>
          <button type="button" className="btn btn-secondary" data-modal-close="">Cancel</button></div>
      </form>}
  </Modal>
}

if (import.meta.env.DEV) {
  FamilyRequestModal.propTypes = {
    data: record.isRequired,
    onClose: PropTypes.func,
    onSaved: PropTypes.func.isRequired,
  }
}
