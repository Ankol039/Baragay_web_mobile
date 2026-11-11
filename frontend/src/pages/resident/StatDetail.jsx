import { Link, Navigate, useSearchParams } from 'react-router-dom'
import useServiceData from '../../hooks/useServiceData.js'
import { getResidentStatDetail } from '../../services/residentService.js'
import usePageTitle from '../../hooks/usePageTitle.js'
import PageHead from '../../components/common/PageHead.jsx'
import PageActionsRow from '../../components/common/PageActionsRow.jsx'
import Card from '../../components/common/Card.jsx'
import Alert from '../../components/common/Alert.jsx'
import { statViews } from './statViews.jsx'

export default function StatDetail() {
  const [params] = useSearchParams()
  const key = params.get('view')
  const view = Object.hasOwn(statViews, key) ? statViews[key] : null
  const { data, error, loading, redirect } = useServiceData(view ? getResidentStatDetail : null, key)
  usePageTitle(view?.title || 'Dashboard')
  if (!view || redirect) return <Navigate to={redirect || '/resident/dashboard'} replace />
  if (error) return <Alert type="error" inline>{error}</Alert>
  if (loading) return <p role="status">Loading…</p>
  return <>
    <PageHead title={view.title} subtitle={view.subtitle}><Link className="back-link" to="/resident/dashboard">← Back to Dashboard</Link></PageHead>
    <PageActionsRow><span className="detail-count"><strong>{data.count}</strong> {view.unit}</span></PageActionsRow>
    <Card><table><thead><tr>{view.columns.map((column, index) => <th key={index}>{column}</th>)}</tr></thead>
      <tbody>{data.rows.length === 0 && <tr><td colSpan={view.columns.length} className="empty-state">Nothing to show here yet.</td></tr>}
        {data.rows.map((row, index) => <tr key={row.survey_id ?? index}>{view.row(row).map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}
      </tbody></table></Card>
  </>
}
