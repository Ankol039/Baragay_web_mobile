import PropTypes from 'prop-types'
import { record, series } from '../../propTypes.js'
import { useMemo } from 'react'
import { Doughnut } from 'react-chartjs-2'
import centreText from './centreText.js'
import { completionOptions, SERIES } from './chartConfig.js'

const plugins = [centreText()]

export default function DoughnutChart({ id, rows, colors = SERIES, options = completionOptions,
  datasetOptions, main, sub, className = 'db-chart-md', label }) {
  const chartOptions = useMemo(() => ({ ...options, plugins: { ...options.plugins, centreText: { ...options.plugins?.centreText, main: main ?? null, sub } } }), [options, main, sub])
  const data = useMemo(() => ({ labels: rows.map(row => row.label), datasets: [{
    data: rows.map(row => row.value), backgroundColor: colors, borderWidth: 0, ...datasetOptions,
  }] }), [rows, colors, datasetOptions])
  return <div className={`db-chart ${className}`}>
    <Doughnut id={id} data={data} options={chartOptions} plugins={plugins} role="img" aria-label={label} />
  </div>
}

if (import.meta.env.DEV) {
  DoughnutChart.propTypes = {
    id: PropTypes.string,
    rows: series.isRequired,
    colors: PropTypes.arrayOf(PropTypes.string),
    options: record,
    datasetOptions: record,
    main: PropTypes.node,
    sub: PropTypes.node,
    className: PropTypes.string,
    label: PropTypes.node,
  }
}
