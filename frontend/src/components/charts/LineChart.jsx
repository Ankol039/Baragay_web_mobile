import PropTypes from 'prop-types'
import { record, series } from '../../propTypes.js'
import { useMemo } from 'react'
import { Chart as ChartJS, LineElement, PointElement, Filler } from 'chart.js'
import { Line } from 'react-chartjs-2'
import './chartConfig.js'

ChartJS.register(LineElement, PointElement, Filler)

export default function LineChart({ id, rows, options, datasetOptions, label, className = 'db-chart-md' }) {
  const data = useMemo(() => ({ labels: rows.map(row => row.label), datasets: [{
    label: 'Responses', data: rows.map(row => row.value), ...datasetOptions,
  }] }), [rows, datasetOptions])
  return <div className={`db-chart ${className}`}><Line id={id} data={data} options={options} role="img" aria-label={label} /></div>
}

if (import.meta.env.DEV) {
  LineChart.propTypes = {
    id: PropTypes.string,
    rows: series.isRequired,
    options: record.isRequired,
    datasetOptions: record,
    label: PropTypes.node,
    className: PropTypes.string,
  }
}
