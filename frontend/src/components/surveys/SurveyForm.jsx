import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createSurvey, updateSurvey } from '../../services/staffSurveyService.js'
import useDirtyWarning from '../../hooks/useDirtyWarning.js'
import Alert from '../common/Alert.jsx'
import SurveyMetadataFields from './SurveyMetadataFields.jsx'
import QuestionEditor from './QuestionEditor.jsx'
import SurveyPreview from './SurveyPreview.jsx'
import { editableQuestion } from './questionTypes.js'

export default function SurveyForm({ initial, creating = false }) {
  const [survey, setSurvey] = useState(initial)
  const [questions, setQuestions] = useState(() => [editableQuestion()])
  const [preview, setPreview] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [busy, setBusy] = useState(false)
  const dirty = useDirtyWarning({ enabled: creating })
  const navigate = useNavigate()
  async function submit(event) {
    event.preventDefault()
    if (busy) return
    dirty.clear(); setBusy(true); setFeedback(null)
    try {
      const body = creating ? { ...survey, questions: questions.map(q => ({ text: q.question_text, type: q.question_type, choices: q.choices.map(choice => choice.choice_text) })) }
        : { ...survey, id: survey.survey_id }
      const result = await (creating ? createSurvey : updateSurvey)(body)
      if (result.redirect) { navigate(result.redirect); return }
      setSurvey(result.data.survey); setFeedback({ type: 'success', message: result.message })
    } catch (error) {
      // PHP re-renders metadata after a rejected POST and rebuilds one blank question.
      if (creating && error.status >= 400) setQuestions([editableQuestion()])
      setFeedback({ type: 'error', message: error.message })
    }
    finally { setBusy(false) }
  }
  return <div className="card">
    <h2>{creating ? 'Create New Survey' : 'Edit Survey'}</h2>
    {feedback && <Alert key={feedback.message} type={feedback.type}>{feedback.message}</Alert>}
    {creating && <p className="field-hint">Fields marked <span className="req">*</span> are required.</p>}
    <form {...(creating ? dirty.formProps : {})} id={creating ? 'survey-builder-form' : undefined} onSubmit={submit}>
      <SurveyMetadataFields value={survey} onChange={setSurvey} creating={creating} />
      {creating && <><h3>Questions</h3><div id="questions-container">
        {questions.map((question, index) => <QuestionEditor key={question.key} builder index={index} question={question}
          onChange={value => { setQuestions(questions.map(q => q.key === question.key ? value : q)); dirty.markDirty() }}
          onRemove={() => { setQuestions(questions.filter(q => q.key !== question.key)); dirty.markDirty() }} />)}
      </div><button type="button" id="add-question-btn" className="btn-secondary" style={{ marginBottom: 20 }}
        onClick={() => { setQuestions([...questions, editableQuestion()]); dirty.markDirty() }}>+ Add Question</button></>}
      <div className="form-actions">
        <button type="submit" className="btn" disabled={busy}>{creating ? 'Save Survey' : 'Save Changes'}</button>
        {creating ? <><button type="button" className="btn btn-secondary" id="preview-survey-btn" onClick={() => setPreview(true)}>Preview Survey</button>
          <Link className="btn btn-secondary" to="/staff/survey-management">Cancel</Link></>
          : <Link className="btn btn-secondary" to={`/staff/question-management?survey_id=${survey.survey_id}`}>Manage Questions</Link>}
      </div>
    </form>
    {creating && <SurveyPreview open={preview} onClose={() => setPreview(false)} survey={survey} questions={questions} />}
  </div>
}

if (import.meta.env.DEV) {
  SurveyForm.propTypes = {
    initial: record.isRequired,
    creating: PropTypes.bool,
  }
}
