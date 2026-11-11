import PropTypes from 'prop-types'
import { records } from '../../propTypes.js'
import { Link } from 'react-router-dom'
import Card from '../common/Card.jsx'

export default function SurveyListPanel({ surveys, answered = false, hasAnswered = false }) {
  return <Card>
    <div className="card-head"><div>
      <h2 className="card-head-title">{`${answered ? 'Already answered' : 'Waiting for your answer'} (${surveys.length})`}</h2>
      <p className="muted-note">{answered
        ? 'Still open, but your response is recorded. Your answers are under Submitted Surveys.'
        : 'These are open now and you have not answered them yet.'}</p>
    </div></div>
    {surveys.length === 0 ? <p className="empty-state">{hasAnswered
      ? 'You are all caught up. Every open survey has been answered.'
      : 'There are no active surveys at the moment. Please check back later.'}</p>
      : <table className="table-spaced"><thead><tr><th>Title</th><th>Description</th><th>Closes</th><th>{answered ? 'Status' : ''}</th></tr></thead>
        <tbody>{surveys.map(survey => <tr key={survey.survey_id}>
          <td>{survey.title}</td><td>{survey.description_short}</td><td>{survey.end_date_label}</td>
          <td>{answered ? <span className="badge badge-inactive">Answered</span>
            : <Link className="btn btn-small" to={`/resident/survey-form?id=${survey.survey_id}`}>Answer Survey</Link>}</td>
        </tr>)}</tbody></table>}
  </Card>
}

if (import.meta.env.DEV) {
  SurveyListPanel.propTypes = {
    surveys: records.isRequired,
    answered: PropTypes.bool,
    hasAnswered: PropTypes.bool,
  }
}
