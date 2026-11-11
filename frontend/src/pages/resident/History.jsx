import { Link } from 'react-router-dom'
import useServiceData from '../../hooks/useServiceData.js'
import { getResidentHistory } from '../../services/residentService.js'
import usePageTitle from '../../hooks/usePageTitle.js'
import PageHead from '../../components/common/PageHead.jsx'
import Card from '../../components/common/Card.jsx'
import Alert from '../../components/common/Alert.jsx'
import Icon from '../../components/common/Icon.jsx'

export default function History() {
  usePageTitle('Submitted Surveys')
  const { data, error, loading } = useServiceData(getResidentHistory)
  if (error) return <Alert type="error" inline>{error}</Alert>
  if (loading) return <p role="status">Loading…</p>
  return <>
    <PageHead title="Submitted Surveys" subtitle="Review your previous survey responses and keep a record of what you submitted." />
    <Card>{data.responses.length === 0 ? <p className="empty-state">You have not submitted any surveys yet.</p>
      : <div className="table-responsive"><table className="table-spaced">
        <thead><tr><th>Survey</th><th>Submitted</th><th>Actions</th></tr></thead>
        <tbody>{data.responses.map(response => <tr key={response.response_id}>
          <td><strong>{response.title}</strong>{response.description && response.description !== '0'
            ? <div className="table-secondary-text">{response.description_short}</div> : null}</td>
          <td>{response.submitted_at_label}</td><td><div className="action-buttons">
            <Link className="btn-action btn-action-primary has-label" to={`/resident/view-response?id=${response.response_id}`}
              title="View submitted answers" aria-label="View submitted answers"><Icon name="eye" /><span>View</span></Link>
          </div></td>
        </tr>)}</tbody>
      </table></div>}</Card>
  </>
}
