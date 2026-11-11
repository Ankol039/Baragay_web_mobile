import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import ChoiceRows from './ChoiceRows.jsx'
import { questionTypes } from './questionTypes.js'

export default function QuestionEditor({ question, onChange, builder = false, index = 0, onRemove, editing = false }) {
  const prefix = editing ? 'edit_' : ''
  const textId = builder ? `question-${question.key}-text` : `${prefix}question_text`
  const typeId = builder ? `question-${question.key}-type` : `${prefix}question_type`
  const textField = <>
    <label htmlFor={textId}>Question Text <span className="req">*</span></label>
    <input type="text" id={textId} name={builder ? `questions[${index}][text]` : 'question_text'} required maxLength={255}
      placeholder={builder ? 'e.g. How long did you wait before being attended to?' : 'e.g. How would you rate our services?'}
      value={question.question_text} onChange={event => onChange({ ...question, question_text: event.target.value })} />
  </>
  const typesAndChoices = <>
    <label htmlFor={typeId}>Question Type</label>
    <select id={typeId} name={builder ? `questions[${index}][type]` : 'question_type'} className="question-type-select"
      value={question.question_type} onChange={event => onChange({ ...question, question_type: event.target.value })}>
      {questionTypes.map(([type, label]) => <option key={type} value={type}>{label}</option>)}
    </select>
    <ChoiceRows question={question} onChange={onChange} editing={editing} name={builder ? `questions[${index}][choices]` : 'choices'} id={editing ? 'edit-choices-inputs' : undefined} />
  </>
  if (!builder) return <>{textField}<div className="question-row">{typesAndChoices}</div></>
  return <div className="card question-row" style={{ background: '#fafcfb' }}>
    <div className="question-row-head"><h4 className="question-row-number">Question {index + 1}</h4>
      <button type="button" className="remove-question-btn btn-action btn-action-danger" title="Remove this question" aria-label="Remove this question" onClick={onRemove}>&times;</button>
    </div>{textField}{typesAndChoices}
  </div>
}

if (import.meta.env.DEV) {
  QuestionEditor.propTypes = {
    question: record.isRequired,
    onChange: PropTypes.func.isRequired,
    builder: PropTypes.bool,
    index: PropTypes.number,
    onRemove: PropTypes.func,
    editing: PropTypes.bool,
  }
}
