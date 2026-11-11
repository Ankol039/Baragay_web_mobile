import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import { useEffect, useRef } from 'react'
import { ageLabel, residencyHint } from './residentForm.js'

const required = <span className="req">*</span>
export default function ResidentPersonalFields({ fields, values, onChange, today, editing = false, residencyControl }) {
  const date = useRef(null)
  const hint = residencyHint(values.residency_start_date, values.residency_status, fields.min_months)
  useEffect(() => { date.current?.setCustomValidity(hint.validity) }, [hint.validity])
  const id = key => `${editing ? 'edit_' : ''}${key}`
  const reference = fields.category_references[values.special_category]
  const input = (key, label, placeholder, mandatory = false, props = {}) => <div>
    <label htmlFor={id(key)}>{label}{mandatory && <> {required}</>}</label>
    <input id={id(key)} name={key} type="text" required={mandatory} placeholder={placeholder} value={values[key]}
      onChange={event => onChange(key, event.target.value)} {...props} />
  </div>
  const select = (key, label, options, mandatory = false) => <div>
    <label htmlFor={id(key)}>{label}{mandatory && <> {required}</>}</label>
    <select id={id(key)} name={key} required={mandatory} value={values[key]} onChange={event => onChange(key, event.target.value)}>
      {Object.entries(options).map(([value, text]) => <option value={value} key={value}>{text}</option>)}
    </select>
  </div>
  return <div className="grid-2">
    {select('courtesy_title', 'Courtesy Title', { '': 'None', ...Object.fromEntries(fields.titles.map(title => [title, title])), Others: 'Others' })}
    {values.courtesy_title === 'Others' && input('courtesy_title_other', 'Specify Title', 'Dr., Engr., Atty.', false, { maxLength: 20, required: true })}
    {input('first_name', 'First Name', 'e.g. Juan', true)}
    {input('middle_name', 'Middle Name', 'e.g. Santos', true)}
    {input('last_name', 'Last Name', 'e.g. Dela Cruz', true)}
    {input('name_extension', 'Extension (e.g. Jr, II)', 'Optional')}
    {input('email', 'Email', 'e.g. juandelacruz@gmail.com', false, { type: 'email' })}
    {input('contact_number', 'Contact Number', 'e.g. 0917 123 4567', false, { type: 'tel', pattern: fields.contact_pattern, maxLength: 20, title: 'Digits, spaces, +, - and brackets only' })}
    {select('gender', 'Gender', { '': 'Select gender', ...fields.genders }, true)}
    {editing ? residencyControl : select('residency_status', 'Residency Status', { permanent: 'Permanent', temporary: 'Temporary' }, true)}
    <div><label htmlFor={id('residency_start_date')}>Residing Here Since {required}</label>
      <input ref={date} type="date" id={id('residency_start_date')} name="residency_start_date" required max={today} data-residency-start=""
        value={values.residency_start_date} onChange={event => onChange('residency_start_date', event.target.value)} />
      <small className={`field-hint${hint.validity ? ' field-hint-warning' : ''}`} data-residency-note="">{hint.text}</small></div>
    {input('birthdate', 'Birthdate', undefined, true, { type: 'date', max: today })}
    <div><label htmlFor={id('age_display')}>Age</label><input type="text" id={id('age_display')} className="field-readonly" readOnly tabIndex={-1}
      placeholder="Select a birthdate" value={ageLabel(values.birthdate)} /><small className="field-hint">Calculated automatically from the birthdate.</small></div>
    {input('birthplace', 'Birthplace', 'e.g. San Ildefonso, Bulacan', true)}
    <div><label htmlFor={id('special_category')}>PWD / Senior Citizen / Pregnant {required}</label>
      <select id={id('special_category')} name="special_category" required value={values.special_category} onChange={event => onChange('special_category', event.target.value)}>
        {Object.entries({ none: 'None', pwd: 'PWD', senior_citizen: 'Senior Citizen', pregnant: 'Pregnant' }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {reference && <div className="category-reference" data-category-reference="">
        <label htmlFor={id('category_reference')}>{reference.label} {required}</label>
        <input type="text" id={id('category_reference')} name="category_reference" required maxLength={60} placeholder={reference.placeholder}
          pattern={reference.pattern} title={reference.error} value={values.category_reference} onChange={event => onChange('category_reference', event.target.value)} />
        <small className="reference-format">{reference.format}</small><small className="field-hint">{reference.hint}</small>
      </div>}
    </div>
  </div>
}

if (import.meta.env.DEV) {
  ResidentPersonalFields.propTypes = {
    fields: record.isRequired,
    values: record.isRequired,
    onChange: PropTypes.func.isRequired,
    today: PropTypes.string.isRequired,
    editing: PropTypes.bool,
    residencyControl: PropTypes.node,
  }
}
