import { record, series } from '../../propTypes.js'
import { useEffect, useRef, useState } from 'react'
import { getTrend } from '../../services/statsService.js'
import ChartCard, { ChartPlaceholder } from '../charts/ChartCard.jsx'
import LineChart from '../charts/LineChart.jsx'
import { trendOptions, trendDataset } from '../charts/staffChartConfig.js'

export default function TrendPanel({ data, rows }) {
  const [from, setFrom] = useState(data.trend_from)
  const [to, setTo] = useState(data.today)
  const [filtered, setFiltered] = useState(null)
  const request = useRef(null)
  useEffect(() => () => request.current?.abort(), [])
  async function load(start, end) {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    try {
      const result = await getTrend(start, end, { signal: controller.signal })
      if (!controller.signal.aborted && result.data) setFiltered(result.data.response_trend)
    } catch { /* The PHP keeps the previous trend in place if filtering fails. */ }
  }
  function reset() {
    const first = data.trend_from
    const last = data.today
    setFrom(first); setTo(last); load(first, last)
  }
  const filter = <div className="db-panel-filter no-print">
    <label htmlFor="trend-from">From</label><input type="date" id="trend-from" value={from} max={data.today} onChange={event => setFrom(event.target.value)} />
    <label htmlFor="trend-to">To</label><input type="date" id="trend-to" value={to} max={data.today} onChange={event => setTo(event.target.value)} />
    <button type="button" className="btn btn-secondary btn-small" id="trend-apply" onClick={() => { if (from && to) load(from, to) }}>Apply</button>
    <button type="button" className="btn btn-secondary btn-small" id="trend-reset" onClick={reset}>Last 30 days</button>
  </div>
  return <ChartCard title="Responses Received" note="Daily submissions over the chosen period." className="db-panel-primary db-c8"
    meta={<span className="db-panel-meta">{data.responses_7} this week</span>} filter={filter}>
    {data.total_responses > 0 ? filtered || rows ? <LineChart id="chart-trend" label="Responses Received" rows={filtered || rows} options={trendOptions} datasetOptions={trendDataset} /> : <ChartPlaceholder id="chart-trend" label="Responses Received" />
      : <div className="db-empty">No responses have been submitted yet.</div>}
  </ChartCard>
}

if (import.meta.env.DEV) {
  TrendPanel.propTypes = {
    data: record.isRequired,
    rows: series,
  }
}
