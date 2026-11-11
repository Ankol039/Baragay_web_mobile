import PropTypes from 'prop-types'
import { records } from '../../propTypes.js'
import { useState } from 'react'
import ChartCard from '../charts/ChartCard.jsx'

export default function CompletionRates({ rows, eligible }) {
  const [expanded, setExpanded] = useState(false)
  return <ChartCard id="completion-rate-card" title="Completion Rate" note={`Share of ${eligible} active residents who answered each open survey.`} className="db-c4">
    {!rows.length && <div className="db-empty">No surveys are open for answers right now.</div>}
    {rows.map((row, i) => <div key={row.survey_id} className={`meter-row${i >= 3 ? expanded ? ' is-shown' : ' is-hidden' : ''}`}>
      <div className="meter-head"><span className="meter-label" title={row.title}>{row.title}</span><span className="meter-value">{row.pct}%</span></div>
      <div className="meter-track"><div className="meter-fill" style={{ width: `${row.pct}%` }} /></div>
      <span className="meter-note">{row.answered} of {eligible} responded</span>
    </div>)}
    {rows.length > 3 && <button type="button" className="view-all-link" data-toggle-more="completion-rate-card" data-label-more={`View All (${rows.length})`} data-expanded={expanded ? '1' : '0'} aria-expanded={expanded}
      onClick={() => setExpanded(value => !value)}>{expanded ? 'Show top 3 only' : `View All (${rows.length})`}</button>}
  </ChartCard>
}

if (import.meta.env.DEV) {
  CompletionRates.propTypes = {
    rows: records.isRequired,
    eligible: PropTypes.number.isRequired,
  }
}
