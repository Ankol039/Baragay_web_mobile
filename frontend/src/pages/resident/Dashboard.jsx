import { Link } from 'react-router-dom'
import usePageTitle from '../../hooks/usePageTitle.js'
import useServiceData from '../../hooks/useServiceData.js'
import { getResidentDashboard } from '../../services/residentService.js'
import PageHead from '../../components/common/PageHead.jsx'
import PageActionsRow from '../../components/common/PageActionsRow.jsx'
import Alert from '../../components/common/Alert.jsx'
import MetricStrip from '../../components/resident/MetricStrip.jsx'
import SurveyOverview from '../../components/resident/SurveyOverview.jsx'
import ResidentAddressPanel from '../../components/resident/ResidentAddressPanel.jsx'
import PersonalCharts, { CompletionPanel } from '../../components/resident/PersonalCharts.jsx'
import DashboardTables from '../../components/resident/DashboardTables.jsx'

export default function Dashboard() {
  usePageTitle('Dashboard')
  const { data, error, loading } = useServiceData(getResidentDashboard)
  if (error) return <Alert type="error" inline>{error}</Alert>
  if (loading) return <p role="status">Loading…</p>
  return <>
    <PageHead title={`Welcome, ${data.resident_name}!`} subtitle="Here's a quick look at your survey activity." />
    <PageActionsRow><Link className="btn" to="/resident/surveys">Answer a Survey</Link></PageActionsRow>
    <Alert><strong>Reminder:</strong> Please complete available surveys before their closing date. Your responses help improve barangay health services.</Alert>
    <MetricStrip data={data} />
    <div className="db-grid"><CompletionPanel data={data} /><SurveyOverview data={data} /><ResidentAddressPanel data={data} /></div>
    <PersonalCharts data={data} />
    <DashboardTables data={data} />
  </>
}
