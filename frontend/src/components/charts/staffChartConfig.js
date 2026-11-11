import { CHART_FONT, INK, INK_MUTED, activityOptions } from './chartConfig.js'

export const STAFF_SERIES = ['#1d6f5e', '#2f6da9', '#f2a541', '#75c79d', '#8a94a6', '#c0392b']
const responsive = { responsive: true, maintainAspectRatio: false }
const pieLegend = { position: 'bottom', labels: {
  usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8,
  padding: 14, color: INK, font: CHART_FONT,
} }
export const staffGaugeOptions = {
  ...responsive, circumference: 180, rotation: 270, cutout: '74%', layout: { padding: { bottom: 6 } },
  plugins: { legend: { display: false }, tooltip: { enabled: false }, centreText: { arcAnchor: true, fontSize: 26 } },
}
export const staffRingOptions = {
  ...responsive, cutout: '66%', layout: { padding: { top: 4, bottom: 4 } }, plugins: { legend: pieLegend, centreText: { arcAnchor: true, fontSize: 26 } },
}
export const demographicRingOptions = rows => {
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  return { ...responsive, cutout: '62%', plugins: { legend: pieLegend, tooltip: { callbacks: {
    label: item => `${item.label}: ${item.parsed} (${total ? Math.round(item.parsed / total * 100) : 0}%)`,
  } } } }
}
export const barValueLabels = {
  id: 'barValueLabels',
  afterDatasetsDraw(chart) {
    chart.data.datasets.forEach((dataset, index) => {
      const meta = chart.getDatasetMeta(index)
      if (meta.hidden) return
      meta.data.forEach((element, i) => {
        const ctx = chart.ctx
        ctx.save()
        ctx.font = `700 11px ${CHART_FONT.family}`
        ctx.fillStyle = INK_MUTED
        ctx.textBaseline = 'middle'
        ctx.fillText(dataset.data[i], element.x + 7, element.y)
        ctx.restore()
      })
    })
  },
}
export const endLabelPlugins = [barValueLabels]
export function horizontalOptions(rows, responses = false) {
  return {
    ...responsive, indexAxis: 'y', layout: { padding: { right: 30 } },
    plugins: { legend: { display: false }, ...(responses ? { tooltip: { callbacks: { title: items => items[0].label } } } : {}) },
    scales: {
      x: { ...activityOptions.scales.y, ...(responses ? { suggestedMax: Math.max(...rows.map(row => row.value), 1) } : {}) },
      y: { grid: { display: false, drawBorder: false }, ticks: {
        color: INK_MUTED, font: CHART_FONT, autoSkip: false,
        callback(value) { const text = this.getLabelForValue(value); return text.length > 18 ? text.slice(0, 17) + '…' : text },
      } },
    },
  }
}
export const trendOptions = {
  ...activityOptions, interaction: { mode: 'index', intersect: false },
  scales: { ...activityOptions.scales, x: { ...activityOptions.scales.x,
    ticks: { color: INK_MUTED, font: CHART_FONT, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
  } },
}
export const trendDataset = {
  borderColor: STAFF_SERIES[0], backgroundColor: 'rgba(29, 111, 94, 0.14)',
  fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2,
}
