import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import useServiceData from '../../hooks/useServiceData.js'
import { listSurveys, getSurvey } from '../../services/staffSurveyService.js'
import usePageTitle from '../../hooks/usePageTitle.js'
import Alert from '../../components/common/Alert.jsx'
import SurveyForm from '../../components/surveys/SurveyForm.jsx'

export default function SurveyEditor() {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const creating = pathname.endsWith('/add-survey')
  const id = params.get('id') || '0'
  usePageTitle(creating ? 'Create Survey' : 'Edit Survey')
  const { data, error, redirect } = useServiceData(creating ? listSurveys : getSurvey, creating ? undefined : id)
  if (redirect) return <Navigate to={redirect} replace />
  return <>
    {!creating && <Link className="back-link" to="/staff/survey-management">&larr; Back to Survey List</Link>}
    {error && <Alert type="error">{error}</Alert>}
    {data ? <SurveyForm key={creating ? 'create' : id} creating={creating} initial={creating
      ? { title: '', description: '', ...data.defaults } : data.survey} /> : !error && <p role="status">Loading…</p>}
  </>
}
