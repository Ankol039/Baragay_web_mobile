import { Link, Navigate } from 'react-router-dom'
import usePageTitle from '../../hooks/usePageTitle.js'
import useStatsData from '../../services/useStatsData.js'
import PageHead from '../../components/common/PageHead.jsx'
import PageActionsRow from '../../components/common/PageActionsRow.jsx'
import Alert from '../../components/common/Alert.jsx'
import DashboardMetrics from '../../components/staff/DashboardMetrics.jsx'
import TrendPanel from '../../components/staff/TrendPanel.jsx'
import DashboardCharts, { ParticipationPanel } from '../../components/staff/DashboardCharts.jsx'
import CompletionRates from '../../components/staff/CompletionRates.jsx'
import DashboardSurveys from '../../components/staff/DashboardSurveys.jsx'
import DashboardFacts, { ResidentRanking } from '../../components/staff/DashboardFacts.jsx'
import QuestionTypes from '../../components/staff/DashboardBars.jsx'
import Demographics from '../../components/staff/Demographics.jsx'
import AdminAccess from '../../components/staff/AdminAccess.jsx'

export default function Dashboard() {
  usePageTitle('Dashboard')
  const { data, error, loading, redirect } = useStatsData('dashboard')
  const charts = { data: data?.charts, loading, error }
  if (redirect) return <Navigate to={redirect} replace />
  if (error) return <Alert type="error" inline>{error}</Alert>
  if (loading || !data) return <p role="status">Loading…</p>
  return <>
    <PageHead title={data.is_admin_view ? 'Admin Dashboard' : 'Staff Dashboard'} subtitle={`Survey activity as of ${data.as_of}.`} />
    <PageActionsRow><Link className="btn" to="/staff/add-survey">+ New Survey</Link></PageActionsRow>
    <DashboardMetrics data={data} />
    <div className="db-grid"><TrendPanel data={data} rows={charts.data?.response_trend} /><ParticipationPanel data={data} /></div>
    <DashboardCharts data={data} stats={charts.data} />
    <div className="db-grid"><CompletionRates rows={data.completion_rates} eligible={data.eligible_residents} /><DashboardSurveys rows={data.surveys_overview} /></div>
    <div className="db-grid"><DashboardFacts data={data} /><ResidentRanking rows={data.top_responders} /><QuestionTypes rows={charts.data?.question_types || []} error={charts.error} loading={charts.loading} /></div>
    {data.demographics_ready && <Demographics stats={charts.data} />}
    {data.is_admin_view && data.admin && <AdminAccess data={data.admin} />}
  </>
}
