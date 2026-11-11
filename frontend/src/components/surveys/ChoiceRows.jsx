import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import { blankChoice } from './questionTypes.js'

export default function ChoiceRows({ question, onChange, editing = false, name = 'choices', id }) {
  const { choices } = question
  function change(index, choice_text) {
    onChange({ ...question, choices: choices.map((choice, i) => i === index ? { ...choice, choice_text } : choice) })
  }
  function remove(index) {
    if (choices.length <= 2) { change(index, ''); return }
    const choice = choices[index]
    onChange({ ...question, choices: choices.filter((_, i) => i !== index),
      removed: choice.choice_id ? { ...question.removed, [choice.choice_id]: '' } : question.removed })
  }
  return <div className="choices-box" style={{ display: question.question_type === 'multiple_choice' ? 'block' : 'none' }}>
    <label>Choices <span className="req">*</span></label>
    <p className="field-hint">{editing ? 'Clearing a box removes that choice, along with the answers recorded against it.' : 'At least two. Blank boxes are ignored when you save.'}</p>
    <div className="choices-inputs" id={id} data-choice-name={editing ? 'new_choices' : name}>
      {choices.map((choice, index) => <div className="choice-row" key={choice.key}>
        <input type="text" name={editing ? (choice.choice_id ? `existing_choices[${choice.choice_id}]` : 'new_choices[]') : `${name}[]`}
          maxLength={150} placeholder={`Choice ${index + 1}`} value={choice.choice_text} onChange={event => change(index, event.target.value)} />
        <button type="button" className="btn-action btn-action-danger remove-choice-btn" title="Remove this choice" aria-label="Remove this choice" onClick={() => remove(index)}>&times;</button>
      </div>)}
    </div>
    <button type="button" className="add-choice-btn btn-secondary btn-small" onClick={() => onChange({ ...question, choices: [...choices, blankChoice()] })}>+ Add Choice</button>
  </div>
}

if (import.meta.env.DEV) {
  ChoiceRows.propTypes = {
    question: record.isRequired,
    onChange: PropTypes.func.isRequired,
    editing: PropTypes.bool,
    name: PropTypes.string,
    id: PropTypes.string,
  }
}
