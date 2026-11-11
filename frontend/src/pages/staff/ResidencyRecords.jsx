import { Link, Navigate, useSearchParams } from 'react-router-dom'
import usePageTitle from '../../hooks/usePageTitle.js'
import useServiceData from '../../hooks/useServiceData.js'
import { getResidencyRecords } from '../../services/accountsService.js'
import PageHead from '../../components/common/PageHead.jsx'
import Alert from '../../components/common/Alert.jsx'
import ResidencyLog from '../../components/requests/ResidencyLog.jsx'

export default function ResidencyRecords() {
  usePageTitle('Residency Records')
  const [params] = useSearchParams()
  const filter = params.get('filter') || ''
  const { data, error, redirect } = useServiceData(getResidencyRecords, filter)
  if (redirect) return <Navigate to={redirect} replace />
  return <>
    <PageHead title="Residency Records" subtitle="Every move between temporary and permanent status, with the address that was on file at the time." />
    {error && <Alert type="error">{error}</Alert>}
    {data ? <>
      {data.filter && <Link className="back-link" to="/staff/residency-records">← Back to Residency Records</Link>}
      <div className="grid-2 mb-4">{[['permanent', data.promotions, 'Made Permanent'], ['temporary', data.reversions, 'Reverted to Temporary']].map(([value, count, label]) =>
        <Link key={value} className={`stat-card stat-card-link${data.filter === value ? ' is-active' : ''}`} to={`?filter=${value}`}><div className="stat-number">{count}</div><div className="stat-label">{label}</div><div className="stat-card-hint">View these records</div></Link>)}</div>
      <ResidencyLog key={data.filter} data={data} />
    </> : !error && <p role="status">Loading…</p>}
  </>
}
