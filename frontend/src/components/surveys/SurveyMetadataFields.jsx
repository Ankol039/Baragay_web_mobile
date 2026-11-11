import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
export default function SurveyMetadataFields({ value, onChange, creating }) {
  const change = event => onChange({ ...value, [event.target.name]: event.target.value })
  const required = creating && <> <span className="req">*</span></>
  return <>
    <label htmlFor="title">Survey Title{required}</label>
    <input type="text" id="title" name="title" required minLength={creating ? 8 : undefined} maxLength={creating ? 150 : undefined}
      placeholder={creating ? 'e.g. Barangay Health Services Satisfaction Survey 2026' : 'e.g. Community Health Assessment 2026'} value={value.title} onChange={change} />
    {creating && <p className="field-hint">8 to 150 characters. Name the topic so residents know what they are answering.</p>}
    <label htmlFor="description">Description</label>
    <textarea id="description" name="description" maxLength={creating ? 500 : undefined} value={value.description || ''} onChange={change}
      placeholder={creating ? 'One or two sentences on why the barangay is collecting these answers.' : undefined} />
    {creating && <p className="field-hint">Optional, up to 500 characters.</p>}
    <div className="grid-2">
      <div><label htmlFor="start_date">Opening Date{required}</label><input type="date" id="start_date" name="start_date" required value={value.start_date} onChange={change} /></div>
      <div><label htmlFor="end_date">Closing Date{required}</label><input type="date" id="end_date" name="end_date" required value={value.end_date} onChange={change} /></div>
    </div>
    {!creating && <><label htmlFor="status">Status</label><select id="status" name="status" value={value.status} onChange={change}>
      <option value="active">Active</option><option value="inactive">Inactive</option>
    </select></>}
  </>
}

if (import.meta.env.DEV) {
  SurveyMetadataFields.propTypes = {
    value: record.isRequired,
    onChange: PropTypes.func.isRequired,
    creating: PropTypes.bool.isRequired,
  }
}
