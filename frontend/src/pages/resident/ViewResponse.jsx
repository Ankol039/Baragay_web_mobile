import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import useServiceData from '../../hooks/useServiceData.js'
import { getResidentResponse } from '../../services/residentService.js'
import { getResponseCsv } from '../../services/surveyService.js'
import usePageTitle from '../../hooks/usePageTitle.js'
import PageHead from '../../components/common/PageHead.jsx'
import Card from '../../components/common/Card.jsx'
import Alert from '../../components/common/Alert.jsx'
import Icon from '../../components/common/Icon.jsx'

export default function ViewResponse() {
  usePageTitle('Submitted Response')
  const [params] = useSearchParams()
  const id = params.get('id') || '0'
  const printMode = params.has('print')
  const printed = useRef(null)
  const [downloadError, setDownloadError] = useState('')
  async function download(event) {
    event.preventDefault()
    try {
      const { csv, filename } = await getResponseCsv(id)
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url; link.download = filename; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setDownloadError('')
    } catch (error) { setDownloadError(error.message) }
  }
  const { data, error, loading, redirect } = useServiceData(getResidentResponse, id)
  useEffect(() => {
    if (!data || !printMode || printed.current === id) return
    printed.current = id
    window.print()
  }, [data, printMode, id])
  if (redirect) return <Navigate to={redirect} replace />
  if (error) return <Alert type="error" inline>{error}</Alert>
  if (loading) return <p role="status">Loading…</p>
  const { response, answers } = data
  return <>
    {downloadError && <Alert type="error" inline>{downloadError}</Alert>}
    <PageHead className="no-print" title="Submitted Response" subtitle="Review the answers you submitted for this survey.">
      <Link className="response-breadcrumb" to="/resident/history"><Icon name="chevron-left" /> <span>Back to Submitted Surveys</span></Link>
    </PageHead>
    <Card className="response-print-card">
      <div className="response-header"><div><h2>{response.title}</h2><p className="muted-note">Submitted {response.submitted_at_label}</p></div>
        <div className="report-actions no-print">
          <button type="button" className="btn btn-secondary" onClick={() => window.print()} aria-label="Print response"><Icon name="reports" /> Print Response</button>
          <a className="btn" href="#" onClick={download}><Icon name="download" /> Download CSV</a>
        </div>
      </div>
      {response.description && response.description !== '0' ? <p className="response-description" style={{ whiteSpace: 'pre-line' }}>{response.description}</p> : null}
      {answers.length === 0 ? <p className="empty-state">No answers were stored for this response.</p>
        : <div className="submitted-answer-list">{answers.map((answer, index) => <div className="submitted-answer" key={answer.question_id}>
          <div className="submitted-question">{`${index + 1}. ${answer.question_text}`}</div>
          <div className="submitted-value" style={{ whiteSpace: 'pre-line' }}>{answer.display_answer}</div>
        </div>)}</div>}
    </Card>
  </>
}
