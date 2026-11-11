import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import AddressFields from '../profile/AddressFields.jsx'

export default function ResidentAddressFields({ fields, values, onChange, editing = false }) {
  const idPrefix = editing ? 'edit_' : ''
  return <>
    <h3 className="form-section-title">Permanent Address</h3>
    <AddressFields registration idPrefix={idPrefix} spec={fields.address} values={values} onChange={onChange} />
    {values.residency_status === 'temporary' && <div className="temp-residence-block" data-temp-block="">
      <h3 className="form-section-title">Temporary Residence</h3>
      <label htmlFor={`${idPrefix}residence_type`}>Type of Residence <span className="req">*</span></label>
      <select id={`${idPrefix}residence_type`} name="residence_type" required value={values.residence_type} onChange={event => onChange('residence_type', event.target.value)}>
        <option value="">Select the type of residence</option>
        {Object.entries(fields.residence_types).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
      </select>
      <h3 className="form-section-title">Temporary Address</h3>
      <AddressFields registration idPrefix={idPrefix} prefix="temp_" spec={fields.address} values={values} onChange={onChange} />
    </div>}
  </>
}

if (import.meta.env.DEV) {
  ResidentAddressFields.propTypes = {
    fields: record.isRequired,
    values: record.isRequired,
    onChange: PropTypes.func.isRequired,
    editing: PropTypes.bool,
  }
}
