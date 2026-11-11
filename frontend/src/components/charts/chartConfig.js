import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip } from 'chart.js'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip)
export const CHART_FONT = { family: "'Segoe UI', Roboto, Arial, sans-serif", size: 12 }
export const INK = '#223028'
export const INK_MUTED = '#6b7c76'
export const SERIES = ['#1d6f5e', '#2f6da9', '#f2a541', '#75c79d']
const legendLabels = { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, color: INK, font: CHART_FONT }
const responsive = { responsive: true, maintainAspectRatio: false }
export const completionOptions = {
  ...responsive, cutout: '68%',
  layout: { padding: { top: 4, bottom: 4, left: 4, right: 4 } },
  plugins: {
    legend: { position: 'bottom', labels: { ...legendLabels, padding: 16, boxPadding: 6 } },
    tooltip: { padding: 10, boxPadding: 6, displayColors: true },
  },
}
export const gaugeOptions = {
  ...responsive, cutout: '72%', rotation: 270, circumference: 180,
  plugins: { legend: { display: false }, tooltip: { enabled: false } },
}
export const householdOptions = {
  ...responsive, cutout: '62%',
  plugins: { legend: { position: 'bottom', labels: { ...legendLabels, padding: 14 } } },
}
export const activityOptions = {
  ...responsive, plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false, drawBorder: false }, ticks: { color: INK_MUTED, font: CHART_FONT } },
    y: { beginAtZero: true, grid: { color: '#e9efec', drawBorder: false }, ticks: { precision: 0, color: INK_MUTED, font: CHART_FONT } },
  },
}
