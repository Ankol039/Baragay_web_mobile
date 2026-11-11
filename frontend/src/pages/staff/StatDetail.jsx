import { Link, Navigate, useSearchParams } from 'react-router-dom'
import useStatsData from '../../services/useStatsData.js'
import usePageTitle from '../../hooks/usePageTitle.js'
import PageHead from '../../components/common/PageHead.jsx'
import PageActionsRow from '../../components/common/PageActionsRow.jsx'
import Card from '../../components/common/Card.jsx'
import Alert from '../../components/common/Alert.jsx'
import { statCells } from './statCells.jsx'

export default function StatDetail() {
  const [params] = useSearchParams()
  const key = params.get('view') || ''
  const valid = Object.hasOwn(statCells, key)
  const { data, error, loading, redirect } = useStatsData(valid ? 'detail' : null, key)
  usePageTitle(data?.title || 'Dashboard')
  if (!valid || redirect) return <Navigate to={redirect || '/staff/dashboard'} replace />
  if (error) return <Alert type="error" inline>{error}</Alert>
  if (loading) return <p role="status">Loading…</p>
  return <>
    <PageHead title={data.title} subtitle={data.subtitle}><Link className="back-link" to="/staff/dashboard">← Back to Dashboard</Link></PageHead>
    <PageActionsRow><span className="detail-count"><strong>{data.count}</strong> {data.unit}</span></PageActionsRow>
    <Card><table><thead><tr>{data.columns.map((column, index) => <th key={index}>{column}</th>)}</tr></thead><tbody>
      {data.rows.length === 0 && <tr><td colSpan={data.columns.length} className="empty-state">Nothing to show here yet.</td></tr>}
      {data.rows.map((row, index) => <tr key={index}>{statCells[key](row).map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}
    </tbody></table></Card>
  </>
}
