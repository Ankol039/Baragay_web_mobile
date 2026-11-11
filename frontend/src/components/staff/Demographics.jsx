import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import ChartCard, { ChartPlaceholder } from '../charts/ChartCard.jsx'
import BarChart from '../charts/BarChart.jsx'
import DoughnutChart from '../charts/DoughnutChart.jsx'
import { activityOptions } from '../charts/chartConfig.js'
import { STAFF_SERIES, demographicRingOptions, horizontalOptions, endLabelPlugins } from '../charts/staffChartConfig.js'

const panels = [
  ['age_groups', 'age', 'Age Groups', 'Worked out from each birthdate, so it never goes stale.', 'db-c6', 'vertical', 0],
  ['gender_mix', 'gender', 'Gender', 'As recorded on each record.', 'db-c3', 'ring'],
  ['priority_groups', 'priority', 'Priority Groups', 'PWD, senior and pregnant residents.', 'db-c3', 'ring'],
  ['occupations', 'occupation', 'Common Occupations', 'Seven most frequent, as they were typed in.', 'db-c5', 'horizontal', 1],
  ['purok_mix', 'purok', 'Residents by Purok', 'Where in the barangay people live.', 'db-c4', 'horizontal', 3],
  ['household', 'household', 'Household Make-up', 'From the marital and children answers.', 'db-c3', 'vertical', 2],
]
function DemographicPanel({ panel, stats }) {
  const [key, id, title, note, className, type, color] = panel
  const rows = stats?.[key] || []
  const chartId = `chart-${id}`
  const size = type === 'ring' ? 'db-chart-sm' : 'db-chart-md'
  return <ChartCard title={title} note={note} className={className}>
    {!rows.length ? <ChartPlaceholder id={chartId} label={title} className={size} />
      : type === 'ring' ? <DoughnutChart id={chartId} label={title} rows={rows} colors={STAFF_SERIES.slice(0, rows.length)} options={demographicRingOptions(rows)} className={size} />
        : <BarChart id={chartId} label={title} rows={rows} datasetLabel="Residents" className={size}
          options={type === 'horizontal' ? horizontalOptions(rows) : activityOptions}
          datasetOptions={{ backgroundColor: STAFF_SERIES[color], maxBarThickness: type === 'horizontal' ? 20 : 46 }}
          plugins={type === 'horizontal' ? endLabelPlugins : undefined} />}
  </ChartCard>
}
export default function Demographics({ stats }) {
  return <>
    <div className="db-section-head"><h2>Resident Demographics</h2></div>
    {[panels.slice(0, 3), panels.slice(3)].map((group, i) => <div className="db-grid" key={i}>{group.map(panel => <DemographicPanel key={panel[0]} panel={panel} stats={stats} />)}</div>)}
  </>
}

if (import.meta.env.DEV) {
  DemographicPanel.propTypes = {
    panel: PropTypes.array.isRequired,
    stats: record,
  }
  Demographics.propTypes = {
    stats: record,
  }
}
