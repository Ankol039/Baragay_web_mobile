import PropTypes from 'prop-types'
import { record, series } from '../../propTypes.js'
import ChartCard, { ChartPlaceholder } from '../charts/ChartCard.jsx'
import DoughnutChart from '../charts/DoughnutChart.jsx'
import BarChart from '../charts/BarChart.jsx'
import { STAFF_SERIES, staffGaugeOptions, staffRingOptions, horizontalOptions, endLabelPlugins } from '../charts/staffChartConfig.js'
import KeyValueList from '../common/KeyValueList.jsx'

export function ParticipationPanel({ data: d }) {
  return <ChartCard title="Participation Rate" note="Active residents who have answered at least one survey." className="db-c4">
    <DoughnutChart id="chart-participation" label="Participation Rate" className="db-chart-xs db-chart-gauge" options={staffGaugeOptions}
      rows={[{ label: 'Responded', value: d.participation }, { label: 'Remaining', value: 100 - d.participation }]}
      colors={[STAFF_SERIES[0], '#e4ebe8']} datasetOptions={{ spacing: 0 }} main={`${d.participation}%`} sub="of residents" />
    <KeyValueList style={{ marginTop: 6 }} rows={[
      ['Residents who answered', `${d.responding_residents} of ${d.eligible_residents}`],
      ['Avg. responses per survey', d.avg_responses], ['Last response received', d.latest_response_label],
    ]} />
  </ChartCard>
}
export function SummaryRing({ id, rows, colors, sub }) {
  return <DoughnutChart id={id} label={sub === 'surveys' ? 'Survey Status' : 'Residency Mix'} className="db-chart-sm" rows={rows} colors={colors}
    options={staffRingOptions} datasetOptions={{ spacing: 0 }} main={String(rows.reduce((sum, row) => sum + row.value, 0))} sub={sub} />
}
export default function DashboardCharts({ data: d, stats }) {
  const responses = stats?.responses_per_survey || []
  return <div className="db-grid">
    <ChartCard title="Responses per Survey" note="Eight most recently created surveys." className="db-c5">
      {d.total_surveys > 0 ? stats ? <BarChart id="chart-responses" label="Responses per Survey" rows={responses} datasetLabel="Responses" className="db-chart-lg"
        options={horizontalOptions(responses, true)} datasetOptions={{ maxBarThickness: 22 }} plugins={endLabelPlugins} />
        : <ChartPlaceholder id="chart-responses" label="Responses per Survey" className="db-chart-lg" />
        : <div className="db-empty">Create a survey to start collecting responses.</div>}
    </ChartCard>
    <ChartCard title="Survey Status" className="db-c3">
      {d.total_surveys > 0 ? stats ? <SummaryRing id="chart-survey-status" rows={stats.survey_status} colors={[STAFF_SERIES[0], STAFF_SERIES[5], STAFF_SERIES[4]]} sub="surveys" /> : <ChartPlaceholder id="chart-survey-status" label="Survey Status" className="db-chart-sm" />
        : <div className="db-empty">No surveys yet.</div>}
    </ChartCard>
    <ChartCard title="Residency Mix" note="Permanent and temporary residents on file." className="db-c4">
      {d.total_residents > 0 ? <>
        {stats ? <SummaryRing id="chart-residency" rows={stats.residency_mix} colors={[STAFF_SERIES[0], STAFF_SERIES[2]]} sub="residents" /> : <ChartPlaceholder id="chart-residency" label="Residency Mix" className="db-chart-sm" />}
        <KeyValueList style={{ marginTop: 6 }} rows={[[ 'Permanent', d.permanent_residents ], ['Temporary', d.temporary_residents]]} />
      </> : <div className="db-empty">No residents registered yet.</div>}
    </ChartCard>
  </div>
}

if (import.meta.env.DEV) {
  ParticipationPanel.propTypes = {
    data: record.isRequired,
  }
  SummaryRing.propTypes = {
    id: PropTypes.string,
    rows: series.isRequired,
    colors: PropTypes.arrayOf(PropTypes.string).isRequired,
    sub: PropTypes.node,
  }
  DashboardCharts.propTypes = {
    data: record.isRequired,
    stats: record,
  }
}
