import { Link, useSearchParams } from 'react-router-dom'
import useServiceData from '../../hooks/useServiceData.js'
import { getSurveyConfirmation } from '../../services/surveyService.js'
import usePageTitle from '../../hooks/usePageTitle.js'
import Alert from '../../components/common/Alert.jsx'

export default function Confirmation() {
  usePageTitle('Submission Confirmed')
  const [params] = useSearchParams()
  const { data, error, loading } = useServiceData(getSurveyConfirmation, params.get('survey_id') || '0')
  if (error) return <Alert type="error" inline>{error}</Alert>
  if (loading) return <p role="status">Loading…</p>
  return <div className="card" style={{ textAlign: 'center', maxWidth: 480, margin: '40px auto' }}>
    <div style={{ fontSize: '3rem', color: '#2e7d32' }}>✔</div>
    <h2>Submission confirmed</h2>
    <p style={{ color: '#6b7c76' }}>Your response to &quot;{data.title}&quot; has been submitted successfully.</p>
    <Link className="btn" to="/resident/surveys">Back to Surveys</Link>
  </div>
}
