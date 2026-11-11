import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import { Fragment } from 'react'

// One renderer for every source question_type; names/values remain PHP-compatible.
export default function QuestionField({ question, index, value = '', onChange, missing = false }) {
  const field = `q${question.question_id}`
  const type = question.question_type
  const options = type === 'multiple_choice'
    ? question.choices.map(choice => ({ id: `${field}_c${choice.choice_id}`, value: `choice_${choice.choice_id}`, text: choice.choice_text }))
    : ['Yes', 'No'].map(text => ({ id: `${field}_${text.toLowerCase()}`, value: text, text }))
  return <div className={`card${missing ? ' missing' : ''}`} style={{ background: '#fafcfb' }} data-required-group={field}>
    <label>{`${index + 1}. ${question.question_text}`}</label>
    {['multiple_choice', 'yesno'].includes(type) ? <div className="option-list">
      {options.map(option => <Fragment key={option.id}>
        <input className="option-input" type="radio" id={option.id} name={field} value={option.value}
          checked={value === option.value} onChange={event => onChange(field, event.target.value)} />
        <label className="option-row" htmlFor={option.id}><span className="option-mark" aria-hidden="true" />
          <span className="option-text">{option.text}</span></label>
      </Fragment>)}
    </div> : type === 'rating' ? <>
      <div className="rating-group">{[1, 2, 3, 4, 5].map(rating => <Fragment key={rating}>
        <input className="rating-input" type="radio" id={`${field}_r${rating}`} name={field} value={rating}
          checked={value === String(rating)} onChange={event => onChange(field, event.target.value)} />
        <label className="rating-btn" htmlFor={`${field}_r${rating}`}>{rating}</label>
      </Fragment>)}</div><p className="rating-legend">1 = Poor, 5 = Excellent</p>
    </> : <textarea name={field} placeholder="Type your answer here (optional)" value={value}
      onChange={event => onChange(field, event.target.value)} />}
  </div>
}

if (import.meta.env.DEV) {
  QuestionField.propTypes = {
    question: record.isRequired,
    index: PropTypes.number.isRequired,
    value: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    missing: PropTypes.bool,
  }
}
