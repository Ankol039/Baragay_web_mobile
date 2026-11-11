import { record } from '../../propTypes.js'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import useServiceData from '../../hooks/useServiceData.js'
import usePageTitle from '../../hooks/usePageTitle.js'
import { getQuestions, deleteQuestion, moveQuestion } from '../../services/staffSurveyService.js'
import Alert from '../../components/common/Alert.jsx'
import Modal from '../../components/common/Modal.jsx'
import ConfirmModal from '../../components/common/ConfirmModal.jsx'
import QuestionList from '../../components/surveys/QuestionList.jsx'
import QuestionModal from '../../components/surveys/QuestionModal.jsx'

function Questions({ data }) {
  const [questions, setQuestions] = useState(data.questions)
  const [editor, setEditor] = useState(null)
  const [pending, setPending] = useState(null)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const surveyId = data.survey.survey_id
  function saved(result) {
    if (result.redirect) { navigate(result.redirect); return }
    setQuestions(result.data.questions); setEditor(null); setError(''); setMessage(result.message); setSuccess(true)
  }
  async function mutate(question, action, move) {
    if (busy) return
    setBusy(true); setPending(null); setError('')
    try { saved(await (action === 'delete' ? deleteQuestion : moveQuestion)({ survey_id: surveyId, question_id: question.question_id, qid: question.question_id, move })) }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }
  return <>
    <div className="card">
      <div className="card-head"><div><h2 className="card-head-title" style={{ margin: 0 }}>{`Questions for: ${data.survey.title}`}</h2>
        <p className="muted-note" style={{ margin: '4px 0 0' }}>Residents answer these in the order shown. Use the arrows to rearrange.</p></div>
        <button type="button" className="btn" disabled={busy} onClick={() => setEditor({})}>+ Add Question</button>
      </div>
      {message && <Alert type="success" style={{ marginTop: 16 }}>{message}</Alert>}
      {error && <Alert type="error" style={{ marginTop: 16 }}>{error}</Alert>}
      <QuestionList questions={questions} busy={busy} onEdit={setEditor} onDelete={setPending} onMove={(q, direction) => mutate(q, 'move', direction)} />
    </div>
    {editor && <QuestionModal key={editor.question_id || 'add'} surveyId={surveyId} question={editor} onClose={() => setEditor(null)} onSaved={saved} />}
    <ConfirmModal id="question-confirm-modal" open={!!pending} message="Delete this question and all related answers?" onClose={() => setPending(null)} onConfirm={() => mutate(pending, 'delete')} />
    <Modal id="question-success-modal" open={success} onClose={() => setSuccess(false)} narrow title="Success" icon={<div className="modal-icon-success">✓</div>}>
      <p style={{ color: 'var(--muted)' }}>{message}</p><div className="modal-actions"><button type="button" className="btn" data-modal-close="">Done</button></div>
    </Modal>
  </>
}
export default function QuestionManagement() {
  usePageTitle('Question Management')
  const [params] = useSearchParams()
  const id = params.get('survey_id') || '0'
  const { data, error, redirect } = useServiceData(getQuestions, id)
  if (redirect) return <Navigate to={redirect} replace />
  return <>
    <Link className="back-link" to="/staff/survey-management">&larr; Back to Survey List</Link>
    {error && <Alert type="error">{error}</Alert>}
    {data ? <Questions key={id} data={data} /> : !error && <p role="status">Loading…</p>}
  </>
}

if (import.meta.env.DEV) {
  Questions.propTypes = {
    data: record.isRequired,
  }
}
