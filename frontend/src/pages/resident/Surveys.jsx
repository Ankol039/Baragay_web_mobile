import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import useServiceData from '../../hooks/useServiceData.js'
import { getResidentSurveys } from '../../services/residentService.js'
import usePageTitle from '../../hooks/usePageTitle.js'
import PageHead from '../../components/common/PageHead.jsx'
import Alert from '../../components/common/Alert.jsx'
import SurveyListPanel from '../../components/resident/SurveyListPanel.jsx'
import SubmissionSuccessModal from '../../components/resident/SubmissionSuccessModal.jsx'

export default function Surveys() {
  usePageTitle('Available Surveys')
  const [params] = useSearchParams()
  const { data, error, loading } = useServiceData(getResidentSurveys, params.get('submitted'))
  const [submitted, setSubmitted] = useState(null)
  useEffect(() => {
    if (!data?.submitted || !params.has('submitted')) return
    let active = true
    queueMicrotask(() => {
      if (!active) return
      setSubmitted(data.submitted)
      // Match the source's address-bar cleanup without starting a route/session
      // transition, which would unmount this one-time confirmation.
      window.history.replaceState(window.history.state, document.title, window.location.pathname)
    })
    return () => { active = false }
  }, [data, params])
  if (error) return <Alert type="error" inline>{error}</Alert>
  if (loading) return <p role="status">Loading…</p>
  return <>
    <PageHead title="Available Surveys" subtitle={<>View and complete surveys assigned to you. Answers you have already sent are kept under <Link to="/resident/history">Submitted Surveys</Link>.</>} />
    <SurveyListPanel surveys={data.open} hasAnswered={data.answered.length > 0} />
    {data.answered.length > 0 && <SurveyListPanel surveys={data.answered} answered />}
    <SubmissionSuccessModal submitted={submitted} onClose={() => setSubmitted(null)} />
  </>
}
