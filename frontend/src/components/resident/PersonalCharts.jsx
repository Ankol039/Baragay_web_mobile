import { record } from '../../propTypes.js'
import ChartCard from '../charts/ChartCard.jsx'
import DoughnutChart from '../charts/DoughnutChart.jsx'
import BarChart from '../charts/BarChart.jsx'
import { gaugeOptions, householdOptions, SERIES } from '../charts/chartConfig.js'
import KeyValueList from '../common/KeyValueList.jsx'

const progressColors = ['#1d6f5e', '#dbe5e1']
const ringDataset = { spacing: 0, borderRadius: 0, hoverOffset: 0 }
export function CompletionPanel({ data }) {
  return <ChartCard title="Your Progress" note="Surveys you have answered out of those assigned to you." className="db-panel-primary db-c4">
    <DoughnutChart id="chart-completion" rows={data.completion} colors={progressColors} datasetOptions={ringDataset}
      main={`${data.completion_pct}%`} sub="completed" label={`Your Progress: ${data.completion_pct}% completed`} />
    <KeyValueList style={{ marginTop: 8 }} rows={[
      ['Completed', data.answered_count], ['Still to answer', data.available_count],
    ]} />
  </ChartCard>
}

export default function PersonalCharts({ data }) {
  const { is_temporary: temporary, residency_months: months, residency_minimum: minimum, residency_pct: pct } = data
  if (!data.has_activity && !data.has_household && !data.has_residency_progress) return null
  const residencyFacts = [['Residing here since', data.residency_start_label], ['Months completed', months]]
  if (temporary) residencyFacts.push(['Still to go', `${Math.max(0, minimum - months)} month(s)`])
  return <div className="db-grid">
    {data.has_activity && <ChartCard title="Your Activity" note="Surveys you submitted over the last six months."
      className="db-c5" meta={<span className="db-panel-meta">{data.answered_count} in total</span>}>
      <BarChart id="chart-activity" rows={data.activity_months} label="Your Activity: surveys submitted over the last six months" />
    </ChartCard>}
    {data.has_residency_progress && <ChartCard title={temporary ? 'Towards Permanent Status' : 'Your Residency'} className="db-c4"
      note={temporary ? `Months completed of the ${minimum} needed before permanent status can be recorded.` : undefined}>
      <DoughnutChart id="chart-residency-progress" rows={[{ label: 'Completed', value: pct }, { label: 'Remaining', value: Math.max(0, 100 - pct) }]}
        colors={progressColors} options={gaugeOptions} datasetOptions={{ spacing: 0, hoverOffset: 0 }}
        main={`${pct}%`} sub={temporary ? 'of the minimum' : 'registered'} className="db-chart-xs db-chart-gauge"
        label={`${temporary ? 'Towards Permanent Status' : 'Your Residency'}: ${pct}%`} />
      <KeyValueList rows={residencyFacts} style={{ marginTop: 6 }} />
      {temporary && <p className="db-panel-note" style={{ marginTop: 8 }}>Reaching the minimum does not change your status on its own — barangay staff record it.</p>}
    </ChartCard>}
    {data.has_household && <ChartCard title="On Your Record" note="People recorded alongside you." className="db-c3">
      <DoughnutChart id="chart-household-mine" rows={data.household_rows} colors={SERIES.slice(0, data.household_rows.length)} options={householdOptions} className="db-chart-sm" label="On Your Record: people recorded alongside you" />
    </ChartCard>}
  </div>
}

if (import.meta.env.DEV) {
  CompletionPanel.propTypes = {
    data: record.isRequired,
  }
  PersonalCharts.propTypes = {
    data: record.isRequired,
  }
}
