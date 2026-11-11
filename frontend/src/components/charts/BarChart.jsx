import PropTypes from 'prop-types'
import { record, series } from '../../propTypes.js'
import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import { activityOptions, SERIES } from './chartConfig.js'

export default function BarChart({ id, rows, datasetLabel = 'Submitted', label, options = activityOptions, className = 'db-chart-md', datasetOptions, plugins }) {
  const data = useMemo(() => ({ labels: rows.map(row => row.label), datasets: [{
    label: datasetLabel, data: rows.map(row => row.value), backgroundColor: SERIES[0], borderRadius: 4, maxBarThickness: 34, ...datasetOptions,
  }] }), [rows, datasetLabel, datasetOptions])
  return <div className={`db-chart ${className}`}><Bar id={id} data={data} options={options} plugins={plugins} role="img" aria-label={label} /></div>
}

if (import.meta.env.DEV) {
  BarChart.propTypes = {
    id: PropTypes.string,
    rows: series.isRequired,
    datasetLabel: PropTypes.string,
    label: PropTypes.node,
    options: record,
    className: PropTypes.string,
    datasetOptions: record,
    plugins: PropTypes.arrayOf(PropTypes.object),
  }
}
