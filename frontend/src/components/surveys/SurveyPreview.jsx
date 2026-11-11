import PropTypes from 'prop-types'
import { record, records } from '../../propTypes.js'
import Modal from '../common/Modal.jsx'
import { questionTypes } from './questionTypes.js'

export default function SurveyPreview({ open, onClose, survey, questions }) {
  return <Modal id="survey-preview-modal" open={open} onClose={onClose} wide>
    <p className="muted-note">Preview only - nothing is saved until you click Save Survey.</p>
    <div id="survey-preview-body">
      <h2 style={{ marginTop: 0 }}>{survey.title.trim() || <em>Untitled survey</em>}</h2>
      {survey.description.trim() && <p style={{ color: 'var(--muted)' }}>{survey.description.trim()}</p>}
      <p className="muted-note">Open {survey.start_date} to {survey.end_date}.</p><hr />
      {!questions.length && <p className="empty-state">No questions added yet.</p>}
      {questions.map((question, index) => <div key={question.key} style={{ marginBottom: 18 }}>
        <p style={{ fontWeight: 600, marginBottom: 6 }}>{index + 1}. {question.question_text.trim() || <em>Empty question</em>} <span className="muted-note">({questionTypes.find(([type]) => type === question.question_type)?.[1]})</span></p>
        {question.question_type === 'multiple_choice' ? <ul style={{ margin: '0 0 0 18px' }}>
          {question.choices.some(choice => choice.choice_text.trim()) ? question.choices.filter(choice => choice.choice_text.trim()).map(choice => <li key={choice.key}>{choice.choice_text.trim()}</li>) : <li><em>No choices entered - this question cannot be saved yet.</em></li>}
        </ul> : <p className="muted-note" style={{ margin: '0 0 0 18px' }}>{({ yesno: 'Yes / No', rating: '1 to 5 stars', short_answer: 'Free-text answer box' })[question.question_type]}</p>}
      </div>)}
    </div>
    <div className="modal-actions"><button type="button" className="btn" data-modal-close="">Back to Editing</button></div>
  </Modal>
}

if (import.meta.env.DEV) {
  SurveyPreview.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func,
    survey: record.isRequired,
    questions: records.isRequired,
  }
}
