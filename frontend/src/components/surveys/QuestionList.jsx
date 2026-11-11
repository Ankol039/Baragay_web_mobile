import PropTypes from 'prop-types'
import { records } from '../../propTypes.js'
import Icon from '../common/Icon.jsx'
import { Fragment } from 'react'
import { questionTypeLabel } from './questionTypes.js'

export default function QuestionList({ questions, onEdit, onDelete, onMove, busy }) {
  if (!questions.length) return <p style={{ color: '#6b7c76', marginTop: 16 }}>No questions yet. Click "+ Add Question" to create one.</p>
  return <table className="table-spaced" style={{ marginTop: 16 }}>
    <thead><tr><th>#</th><th>Question</th><th>Type</th><th>Choices</th><th>Order</th><th>Actions</th></tr></thead>
    <tbody>{questions.map((question, index) => <tr key={question.question_id}>
      <td>{index + 1}</td><td>{question.question_text}</td><td>{questionTypeLabel(question.question_type)}</td>
      <td>{question.choices.map(choice => choice.choice_text).join(', ') || '—'}</td>
      <td className="nowrap">{[['up', '↑', index > 0], ['down', '↓', index < questions.length - 1]].map(([direction, arrow, enabled], position) => <Fragment key={direction}>{position > 0 && ' '}{enabled
        ? <button key={direction} type="button" className="btn-action" title={`Move ${direction}`} aria-label={`Move ${direction}`} disabled={busy} onClick={() => onMove(question, direction)}>{arrow}</button>
        : <span key={direction} className="btn-action btn-action-muted" aria-hidden="true">{arrow}</span>}</Fragment>)}</td>
      <td className="nowrap"><button type="button" className="btn-action btn-action-primary edit-question-btn" title="Edit question" aria-label="Edit question" disabled={busy} onClick={() => onEdit(question)}><Icon name="edit" /></button>{' '}
        <button type="button" className="btn-action btn-action-danger" title="Delete question" aria-label="Delete question" disabled={busy} onClick={() => onDelete(question)}><Icon name="trash" /></button></td>
    </tr>)}</tbody>
  </table>
}

if (import.meta.env.DEV) {
  QuestionList.propTypes = {
    questions: records.isRequired,
    onEdit: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
    onMove: PropTypes.func.isRequired,
    busy: PropTypes.bool,
  }
}
