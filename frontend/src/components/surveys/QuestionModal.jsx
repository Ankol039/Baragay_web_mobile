import PropTypes from 'prop-types'
import { identifier, record } from '../../propTypes.js'
import { useState } from 'react'
import Modal from '../common/Modal.jsx'
import Alert from '../common/Alert.jsx'
import QuestionEditor from './QuestionEditor.jsx'
import { editableQuestion, questionPayload } from './questionTypes.js'
import useDirtyWarning from '../../hooks/useDirtyWarning.js'
import { createQuestion, updateQuestion } from '../../services/staffSurveyService.js'

export default function QuestionModal({ surveyId, question, onClose, onSaved }) {
  const editing = !!question?.question_id
  const [value, setValue] = useState(() => editableQuestion(question))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const dirty = useDirtyWarning()
  async function submit(event) {
    event.preventDefault()
    if (busy) return
    dirty.clear(); setBusy(true); setError('')
    try {
      const result = await (editing ? updateQuestion : createQuestion)({ survey_id: surveyId, question_id: question?.question_id || 0, ...questionPayload(value) })
      onSaved(result)
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }
  return <Modal id={editing ? 'edit-question-modal' : 'add-question-modal'} open onClose={onClose} beforeClose={() => !busy && dirty.confirmDiscard()} title={editing ? 'Edit Question' : 'Add Question'}>
    {error && <Alert type="error">{error}</Alert>}
    <form {...dirty.formProps} id={editing ? 'edit-question-form' : 'add-question-form'} onSubmit={submit}>
      <QuestionEditor question={value} editing={editing} onChange={next => { setValue(next); dirty.markDirty() }} />
      <div className="modal-actions">
        <button type="submit" className="btn" disabled={busy}>{editing ? 'Save Changes' : 'Add Question'}</button>
        <button type="button" className="btn btn-secondary" data-modal-close="" disabled={busy}>Cancel</button>
      </div>
    </form>
  </Modal>
}

if (import.meta.env.DEV) {
  QuestionModal.propTypes = {
    surveyId: identifier.isRequired,
    question: record,
    onClose: PropTypes.func,
    onSaved: PropTypes.func.isRequired,
  }
}
