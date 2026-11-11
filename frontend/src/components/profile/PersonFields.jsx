import PropTypes from 'prop-types'
import { fieldSpec, record } from '../../propTypes.js'
import { Fragment } from 'react'

export default function PersonFields({ spec, values, onChange, nameFor = key => key, idPrefix = 'person', identity = false }) {
  const custom = values.courtesy_title === 'Others'
  return <>{Object.entries(spec).filter(([key]) => !identity || key !== 'gender').map(([key, field]) => {
    const id = `${idPrefix}_${key}`
    const otherInput = <input type="text" id={`${id}_other`} name={nameFor('courtesy_title_other')} maxLength={20}
      data-title-other={identity ? undefined : ''} placeholder="Dr., Engr., Atty." hidden={!custom} required={identity && custom}
      aria-label="Specify Title" value={values.courtesy_title_other || ''} onChange={event => onChange('courtesy_title_other', event.target.value)} />
    return <Fragment key={key}><div>
      <label htmlFor={id}>{field.label}{!identity && field.required && <> <span className="req">*</span></>}</label>
      {field.type === 'select' ? <>
        <select id={id} name={nameFor(key)} value={values[key] || ''} data-title-select={key === 'courtesy_title' ? '' : undefined}
          onChange={event => onChange(key, event.target.value)}>
          <option value="">{identity ? 'None' : 'Select'}</option>
          {(Array.isArray(field.options) ? field.options.map(value => [value, value]) : Object.entries(field.options)).map(([value, label]) =>
            <option key={value} value={value}>{label}</option>)}
          {key === 'courtesy_title' && <option value="Others">Others</option>}
        </select>
        {key === 'courtesy_title' && !identity && otherInput}
      </> : <input type="text" id={id} name={nameFor(key)} maxLength={identity ? undefined : field.maxlength}
        placeholder={identity && key === 'name_extension' ? 'Jr., Sr., III' : field.placeholder}
        value={values[key] || ''} onChange={event => onChange(key, event.target.value)} />}
    </div>{key === 'courtesy_title' && identity && <div data-title-other="" hidden={!custom}>
      <label htmlFor={`${id}_other`}>Specify Title</label>{otherInput}
    </div>}</Fragment>
  })}</>
}

if (import.meta.env.DEV) {
  PersonFields.propTypes = {
    spec: fieldSpec.isRequired,
    values: record.isRequired,
    onChange: PropTypes.func.isRequired,
    nameFor: PropTypes.func,
    idPrefix: PropTypes.string,
    identity: PropTypes.bool,
  }
}
