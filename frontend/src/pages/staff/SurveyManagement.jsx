import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import useServiceData from '../../hooks/useServiceData.js'
import usePageTitle from '../../hooks/usePageTitle.js'
import { listSurveys, toggleSurvey, deleteSurvey } from '../../services/staffSurveyService.js'
import PageHead from '../../components/common/PageHead.jsx'
import Alert from '../../components/common/Alert.jsx'
import ConfirmModal from '../../components/common/ConfirmModal.jsx'
import SurveyTable from '../../components/surveys/SurveyTable.jsx'

export default function SurveyManagement() {
  usePageTitle('Survey Management')
  const { data, error, redirect } = useServiceData(listSurveys)
  const [rows, setRows] = useState(null)
  const [pending, setPending] = useState(null)
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)
  if (redirect) return <Navigate to={redirect} replace />
  async function perform() {
    if (busy) return
    const { survey, kind } = pending
    setPending(null); setBusy(true); setFailure('')
    try {
      await (kind === 'delete' ? deleteSurvey : toggleSurvey)(survey.survey_id)
      const result = await listSurveys()
      setRows(result.data?.surveys)
    } catch (err) { setFailure(err.message) }
    finally { setBusy(false) }
  }
  const message = pending?.kind === 'delete' ? `Delete “${pending.survey.title}”? This will also delete its questions, choices, responses, and results. This action cannot be undone.`
    : `${pending?.survey.status === 'active' ? 'Deactivate' : 'Activate'} this survey?`
  return <>
    <PageHead title="Surveys" subtitle="Create, edit and publish the surveys residents can answer." />
    <div className="page-actions-row"><Link className="btn" to="/staff/add-survey">+ Create New Survey</Link></div>
    {(error || failure) && <Alert type="error">{error || failure}</Alert>}
    <div className="card">{data ? <SurveyTable surveys={rows || data.surveys} onAction={(survey, kind) => setPending({ survey, kind })} busy={busy} /> : !error && <p role="status">Loading…</p>}</div>
    <ConfirmModal id="survey-confirm-modal" open={!!pending} message={message} onClose={() => setPending(null)} onConfirm={perform} />
  </>
}
