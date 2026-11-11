import PropTypes from 'prop-types'
import { fieldSpec, records } from '../../propTypes.js'
import { useId, useRef } from 'react'
import { emptyPerson } from '../../config/personFields.js'
import PersonFields from './PersonFields.jsx'

export default function RepeatablePersonRows({ name, rows, onChange, spec, noun, addLabel }) {
  const id = useId()
  const group = useRef(null)
  function add() {
    onChange([...rows, emptyPerson(spec)])
    requestAnimationFrame(() => group.current?.lastElementChild?.querySelector('input')?.focus())
  }
  return <>
    <div className="person-rows" data-person-rows={name} data-row-noun={noun} ref={group}>
      {rows.map((row, index) => <div className="person-row" data-person-row="" key={index}>
        <div className="person-row-head">
          <span className="person-row-title">{noun} <span data-row-number="">{index + 1}</span></span>
          <button type="button" className="btn-link-danger" style={{ display: rows.length > 1 ? undefined : 'none' }}
            onClick={() => onChange(rows.filter((_, position) => position !== index))}>Remove</button>
        </div>
        <div className="grid-2"><PersonFields spec={spec} values={row} idPrefix={`${id}_${index}`}
          nameFor={key => `${name}[${index}][${key}]`}
          onChange={(key, value) => onChange(rows.map((person, position) => position === index ? { ...person, [key]: value,
            ...(key === 'courtesy_title' ? { courtesy_title_other: '' } : {}) } : person))} /></div>
      </div>)}
    </div>
    <button type="button" className="btn btn-secondary btn-small" onClick={add}>{addLabel}</button>
  </>
}

if (import.meta.env.DEV) {
  RepeatablePersonRows.propTypes = {
    name: PropTypes.string.isRequired,
    rows: records.isRequired,
    onChange: PropTypes.func.isRequired,
    spec: fieldSpec.isRequired,
    noun: PropTypes.string.isRequired,
    addLabel: PropTypes.string.isRequired,
  }
}
