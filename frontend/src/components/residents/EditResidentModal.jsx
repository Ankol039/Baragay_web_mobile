import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import Modal from '../common/Modal.jsx'
import Alert from '../common/Alert.jsx'
import FamilyFields from '../profile/FamilyFields.jsx'
import ResidentPersonalFields from './ResidentPersonalFields.jsx'
import ResidentAddressFields from './ResidentAddressFields.jsx'
import ResidencySwitch from './ResidencySwitch.jsx'
import { editableResident } from './residentForm.js'
import useResidentSubmission from '../../hooks/useResidentSubmission.js'

export default function EditResidentModal({ data, detail, onClose, onSaved, onSwitch }) {
  const resident = detail.resident
  const [values, setValues] = useState(() => editableResident(resident, data.fields))
  const form = useResidentSubmission(onSaved)
  function change(key, value) {
    setValues(previous => ({ ...previous, [key]: value,
      ...(key === 'special_category' && value === 'none' ? { category_reference: '' } : {}),
      ...(key === 'courtesy_title' && value !== 'Others' ? { courtesy_title_other: '' } : {}) }))
  }
  if (form.redirect) return <Navigate to={form.redirect} replace />
  return <Modal id="edit-resident-info-modal" title="Edit Resident Info" wide open onClose={onClose} beforeClose={() => !form.busy}>
    {form.error && <Alert type="error">{form.error}</Alert>}
    <form method="POST" onSubmit={event => form.submit(event, values)}>
      <input type="hidden" name="update_resident" value="1" /><input type="hidden" name="resident_id" value={resident.resident_id} />
      <ResidentPersonalFields editing fields={data.fields} values={values} onChange={change} today={data.today}
        residencyControl={<ResidencySwitch resident={resident} canManage={data.can_delete} onSwitch={onSwitch} />} />
      <ResidentAddressFields editing fields={data.fields} values={values} onChange={change} />
      <FamilyFields fields={data.fields} values={values} onChange={change} idPrefix="edit" />{' '}
      <button type="submit" disabled={form.busy}>Update Resident</button>{' '}
      <button type="button" className="btn-secondary" data-modal-close="" disabled={form.busy}>Cancel</button>
    </form>
  </Modal>
}

if (import.meta.env.DEV) {
  EditResidentModal.propTypes = {
    data: record.isRequired,
    detail: record.isRequired,
    onClose: PropTypes.func,
    onSaved: PropTypes.func.isRequired,
    onSwitch: PropTypes.func,
  }
}
