import PropTypes from 'prop-types'
import { identifier, records } from '../../propTypes.js'
import Card from '../common/Card.jsx'
import { useState } from 'react'
import Alert from '../common/Alert.jsx'
import { exportReport } from '../../services/statsService.js'

export default function SurveySelector({ surveys, surveyId, onChange, report = false }) {
  const [error, setError] = useState('')
  async function download(event) {
    event.preventDefault()
    setError('')
    try {
      const result = await exportReport(surveyId)
      if (result.redirect) onChange('')
    } catch (failure) { setError(failure.message) }
  }
  return <Card className="no-print">
    <form method="GET" onSubmit={event => event.preventDefault()}>
      <label htmlFor="survey_id">{report ? 'Select a Survey' : 'Select a Survey to View Results'}</label>
      <select id="survey_id" name="survey_id" value={surveyId || ''} onChange={event => onChange(event.target.value)} style={report ? undefined : { maxWidth: 400 }}>
        <option value="">-- Choose a survey --</option>
        {surveys.map(survey => <option key={survey.survey_id} value={survey.survey_id}>{survey.title}</option>)}
      </select>
    </form>
    {report && Boolean(surveyId) && <div style={{ marginTop: 14 }}>
      <button type="button" className="btn" onClick={() => window.print()}>Print Report</button>{' '}
      <a className="btn btn-secondary" href="#" onClick={download}>Export to CSV (Excel)</a>
    </div>}
    {error && <Alert type="error" inline>{error}</Alert>}
  </Card>
}

if (import.meta.env.DEV) {
  SurveySelector.propTypes = {
    surveys: records.isRequired,
    surveyId: identifier.isRequired,
    onChange: PropTypes.func.isRequired,
    report: PropTypes.bool,
  }
}
