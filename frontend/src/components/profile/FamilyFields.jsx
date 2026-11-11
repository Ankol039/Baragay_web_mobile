import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import PersonFields from './PersonFields.jsx'
import RepeatablePersonRows from './RepeatablePersonRows.jsx'

function YesNo({ name, label, value, onChange }) {
  return <div className="choice-row" role="group" aria-label={label}>
    <span className="choice-question">{label}</span>
    {['1', '0'].map(option => <label className="choice-option" key={option}>
      <input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(name, option)} />
      <span>{option === '1' ? 'Yes' : 'No'}</span>
    </label>)}
  </div>
}
export default function FamilyFields({ fields, values, onChange, idPrefix = 'req' }) {
  const personProps = who => ({ spec: fields.person, idPrefix: `${idPrefix}_${who}`,
    values: Object.fromEntries(Object.keys(fields.person).concat('courtesy_title_other').map(key => [key, values[`${who}_${key}`] || ''])),
    nameFor: key => `${who}_${key}`, onChange: (key, value) => onChange(`${who}_${key}`, value) })
  return <>
    <h3 className="form-section-title">Work and Household Contact</h3>
    <div className="grid-2">
      <div><label htmlFor={`${idPrefix}_occupation`}>Occupation</label>
        <input type="text" id={`${idPrefix}_occupation`} name="occupation" maxLength={100} placeholder="e.g. Student, Tricycle driver, Teacher, N/A"
          value={values.occupation} onChange={event => onChange('occupation', event.target.value)} />
        <small className="field-hint">Type it in full. Put &quot;N/A&quot; if they are not working or studying.</small></div>
      <div><label htmlFor={`${idPrefix}_hotline_number`}>Hotline Number</label>
        <input type="text" id={`${idPrefix}_hotline_number`} name="hotline_number" maxLength={30} pattern={fields.hotline_pattern}
          title={fields.hotline_hint} placeholder="(02) 8123-4567" value={values.hotline_number} onChange={event => onChange('hotline_number', event.target.value)} />
        <small className="field-hint">Optional. {fields.hotline_hint}</small></div>
    </div>
    <h3 className="form-section-title">Spouse</h3>
    <YesNo name="is_married" label="Is this resident married?" value={values.is_married} onChange={onChange} />
    {values.is_married === '1' && <div className="reveal-block"><div className="grid-2"><PersonFields {...personProps('spouse')} /></div></div>}
    <h3 className="form-section-title">Children</h3>
    <YesNo name="has_children" label="Does this resident have children?" value={values.has_children} onChange={onChange} />
    {values.has_children === '1' && <div className="reveal-block"><RepeatablePersonRows name="children" noun="Child" addLabel="+ Add another child"
      rows={values.children} spec={fields.person} onChange={rows => onChange('children', rows)} /></div>}
    <h3 className="form-section-title">Parents</h3><p className="form-section-note">Optional. Fill in what is known.</p>
    <div className="grid-2">{['father', 'mother'].map(who => <div className="parent-column" key={who}>
      <h4 className="form-subsection-title">{who === 'father' ? 'Father' : 'Mother'}&apos;s Name</h4><PersonFields {...personProps(who)} />
    </div>)}</div>
    <h3 className="form-section-title">Character References <span className="req">*</span></h3>
    <p className="form-section-note">At least one is required, whether the resident is temporary or permanent. Add more if there are others who can vouch for them.</p>
    <RepeatablePersonRows name="references" noun="Character reference" addLabel="+ Add another reference" rows={values.references}
      spec={fields.person} onChange={rows => onChange('references', rows)} />
  </>
}

if (import.meta.env.DEV) {
  YesNo.propTypes = {
    name: PropTypes.string.isRequired,
    label: PropTypes.node,
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
  }
  FamilyFields.propTypes = {
    fields: record.isRequired,
    values: record.isRequired,
    onChange: PropTypes.func.isRequired,
    idPrefix: PropTypes.string,
  }
}
