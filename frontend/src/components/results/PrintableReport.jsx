import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import Card from '../common/Card.jsx'

export default function PrintableReport({ data }) {
  const { survey, total_respondents: totalRespondents, generated_on: generatedOn, questions } = data
  const metadata = [['Survey Title', survey.title], ['Description', survey.description],
    ['Period', `${survey.start_date} to ${survey.end_date}`], ['Prepared by', survey.created_by_name ?? 'N/A'],
    ['Total Respondents', totalRespondents], ['Generated on', generatedOn]]
  return <>
    <Card>
      <h2 style={{ textAlign: 'center', marginBottom: 0 }}>Barangay Health Center</h2>
      <p style={{ textAlign: 'center', color: '#6b7c76', marginTop: 4 }}>Survey Report</p><hr />
      {metadata.map(([label, value]) => <p key={label}><strong>{`${label}:`}</strong>{` ${value ?? ''}`}</p>)}
    </Card>
    {questions.map((question, index) => <ReportQuestionSection key={question.question_id} question={question} index={index} />)}
  </>
}

function ReportQuestionSection({ question, index }) {
  return <Card>
    <h3>{`${index + 1}. ${question.question_text}`}</h3>
    <p className="muted-note">{`Based on ${question.answered_here} response${question.answered_here === 1 ? '' : 's'}.`}</p>
    {question.question_type === 'short_answer'
      ? question.rows.length === 0 ? <p style={{ color: '#6b7c76' }}>No responses.</p> : <ul>{question.rows.map((row, i) => <li key={i}>{row.answer_text}</li>)}</ul>
      : <table><thead><tr><th>Option</th><th>Count</th></tr></thead><tbody>{question.rows.map((row, i) => <tr key={i}><td>{row.choice_text}</td><td>{Number(row.votes)}</td></tr>)}</tbody></table>}
  </Card>
}

if (import.meta.env.DEV) {
  PrintableReport.propTypes = {
    data: record.isRequired,
  }
  ReportQuestionSection.propTypes = {
    question: record.isRequired,
    index: PropTypes.number.isRequired,
  }
}
