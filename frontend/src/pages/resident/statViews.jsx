import { Link } from 'react-router-dom'

const answer = row => <Link key="answer" className="btn btn-small" to={`/resident/survey-form?id=${row.survey_id}`}>Answer Survey</Link>
export const statViews = {
  available: {
    title: 'Surveys Available', subtitle: 'Open surveys you have not answered yet.', unit: 'Surveys Waiting',
    columns: ['Survey', 'Description', 'Closes On', ''],
    row: row => [row.title, row.description && row.description !== '0' ? row.description : '—', row.end_date_label, answer(row)],
  },
  completed: {
    title: 'Surveys Completed', subtitle: 'Surveys you have already submitted answers for.', unit: 'Surveys Completed',
    columns: ['Survey', 'Submitted On', 'Status'],
    row: row => [row.title, row.submitted_at_label, <span key="status" className="badge badge-active">Submitted</span>],
  },
  assigned: {
    title: 'Surveys Assigned', subtitle: 'Every currently open survey assigned to you, with your answer status.', unit: 'Surveys Assigned',
    columns: ['Survey', 'Closes On', 'Status', ''],
    row: row => [row.title, row.end_date_label,
      <span key="status" className={`badge ${row.answered === 1 ? 'badge-active' : 'badge-inactive'}`}>{row.answered === 1 ? 'Answered' : 'Not yet answered'}</span>,
      row.answered === 1 ? '' : answer(row)],
  },
}
