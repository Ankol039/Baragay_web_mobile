import PropTypes from 'prop-types'
import { fieldSpec, record } from '../../propTypes.js'
import { addressLine } from '../../config/addressFields.js'

export default function AddressFields({ spec, values, onChange, prefix = '', derived = false, registration = false, idPrefix = '' }) {
  return <>
    <div className="grid-2">{Object.entries(spec).map(([key, field]) => <div key={key}>
      <label htmlFor={idPrefix + prefix + key}>{field.label}{(!prefix || registration) && field.required && <> <span className="req">*</span></>}</label>
      <input type="text" id={idPrefix + prefix + key} name={prefix + key} placeholder={field.placeholder} required={registration && field.required} maxLength={registration && key !== 'postal_code' ? undefined : field.maxlength}
        inputMode={key === 'postal_code' ? 'numeric' : undefined} value={values[prefix + key] || ''}
        onChange={event => onChange(prefix + key, event.target.value)} />
    </div>)}</div>
    {derived && <p className="field-hint">Complete Address: <output>{addressLine(spec, values, prefix) || 'N/A'}</output></p>}
  </>
}

if (import.meta.env.DEV) {
  AddressFields.propTypes = {
    spec: fieldSpec.isRequired,
    values: record.isRequired,
    onChange: PropTypes.func.isRequired,
    prefix: PropTypes.string,
    derived: PropTypes.bool,
    registration: PropTypes.bool,
    idPrefix: PropTypes.string,
  }
}
