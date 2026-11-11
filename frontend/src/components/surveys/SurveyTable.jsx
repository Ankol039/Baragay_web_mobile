import PropTypes from 'prop-types'
import { records } from '../../propTypes.js'
import { Link } from 'react-router-dom'
import DataTable from '../common/DataTable.jsx'
import Icon from '../common/Icon.jsx'

export default function SurveyTable({ surveys, onAction, busy }) {
  const action = (survey, kind) => <button type="button" className={`btn-action btn-action-${kind === 'delete' || survey.status === 'active' ? 'danger' : 'success'}`}
    title={kind === 'delete' ? 'Delete survey' : `${survey.status === 'active' ? 'Deactivate' : 'Activate'} survey`}
    aria-label={kind === 'delete' ? 'Delete survey' : `${survey.status === 'active' ? 'Deactivate' : 'Activate'} survey`}
    disabled={busy} onClick={() => onAction(survey, kind)}><Icon name={kind === 'delete' ? 'trash' : 'power'} /></button>
  const columns = [
    { key: 'title', label: 'Title' },
    { key: 'period', label: 'Period', render: survey => <>{survey.start_date} &ndash; {survey.end_date}</> },
    { key: 'status', label: 'Status', render: survey => <span className={`badge badge-${survey.status}`}>{survey.status === 'active' ? 'Active' : 'Inactive'}</span> },
    { key: 'response_count', label: 'Responses' },
    { key: 'actions', label: 'Actions', render: survey => <div className="action-buttons">
      <Link className="btn-action" title="Edit survey" aria-label="Edit survey" to={`/staff/edit-survey?id=${survey.survey_id}`}><Icon name="edit" /></Link>
      <Link className="btn-action" title="Manage questions" aria-label="Manage questions" to={`/staff/question-management?survey_id=${survey.survey_id}`}><Icon name="surveys" /></Link>
      <Link className="btn-action btn-action-primary" title="View results" aria-label="View results" to={`/staff/results-dashboard?survey_id=${survey.survey_id}`}><Icon name="results" /></Link>
      {action(survey, 'toggle')}{action(survey, 'delete')}
    </div> },
  ]
  return <DataTable id="surveys-table" title="All Surveys" columns={columns} rowKey="survey_id"
    rows={surveys.map(survey => ({ ...survey, filter: survey.status, searchText: `${survey.title} ${survey.start_date} ${survey.end_date} ${survey.status}` }))}
    searchId="survey-search" searchPlaceholder="Search surveys..." searchLabel="Search surveys" emptyMessage="No surveys match your search."
    filters={[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
}

if (import.meta.env.DEV) {
  SurveyTable.propTypes = {
    surveys: records.isRequired,
    onAction: PropTypes.func.isRequired,
    busy: PropTypes.bool,
  }
}
