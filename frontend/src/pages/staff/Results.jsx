import PropTypes from 'prop-types'
import { Navigate, useSearchParams } from 'react-router-dom'
import useStatsData from '../../services/useStatsData.js'
import usePageTitle from '../../hooks/usePageTitle.js'
import PageHead from '../../components/common/PageHead.jsx'
import Alert from '../../components/common/Alert.jsx'
import SurveySelector from '../../components/results/SurveySelector.jsx'
import ResultEmptyState from '../../components/results/ResultEmptyState.jsx'
import ResultSummary from '../../components/results/ResultSummary.jsx'
import QuestionResultCard from '../../components/results/QuestionResultCard.jsx'
import PrintableReport from '../../components/results/PrintableReport.jsx'

export default function Results({ report = false }) {
  usePageTitle(report ? 'Printable Report' : 'Results Dashboard')
  const [params, setParams] = useSearchParams()
  const id = params.get('survey_id') || '0'
  const { data, loading, error, redirect } = useStatsData('results', id, report)
  if (redirect) return <Navigate to={redirect} replace />
  if (error) return <Alert type="error" inline>{error}</Alert>
  if (loading) return <p role="status">Loading…</p>
  return <>
    <PageHead className={report ? 'no-print' : ''} title={report ? 'Reports' : 'Results'} subtitle={report ? 'Generate a printable or exportable report for any survey.' : 'Choose a survey to see how residents answered.'} />
    <SurveySelector surveys={data.surveys} surveyId={data.survey_id} report={report} onChange={value => setParams({ survey_id: value })} />
    {data.survey ? report ? <PrintableReport data={data} /> : <>
      <ResultSummary survey={data.survey} totalRespondents={data.total_respondents} />
      {data.questions.map((question, index) => <QuestionResultCard key={question.question_id} question={question} index={index} />)}
    </> : data.survey_id ? <Alert type="error">Survey not found.</Alert> : <ResultEmptyState report={report} />}
  </>
}

export function Reports() { return <Results report /> }

if (import.meta.env.DEV) {
  Results.propTypes = {
    report: PropTypes.bool,
  }
}
