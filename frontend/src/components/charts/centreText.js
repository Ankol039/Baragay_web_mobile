import { CHART_FONT, INK, INK_MUTED } from './chartConfig.js'

// Local plugin per chart: independent text, with the original PHP drawing coordinates.
export default function centreText(initialMain, initialSub) {
  return {
    id: 'centreText',
    afterDraw(chart, _args, options = {}) {
      const main = options.main ?? initialMain
      const sub = options.sub ?? initialSub
      if (main == null) return
      const area = chart.chartArea
      if (!area) return
      const { ctx } = chart
      const x = (area.left + area.right) / 2
      const half = options.arcAnchor && chart.options.circumference === 180
      const arc = options.arcAnchor ? chart.getDatasetMeta(0)?.data?.[0] : null
      const y = arc ? arc.y : (area.top + area.bottom) / 2
      ctx.save()
      ctx.textAlign = 'center'
      ctx.fillStyle = INK
      ctx.font = `700 ${options.fontSize ?? 28}px ${CHART_FONT.family}`
      ctx.textBaseline = half ? 'bottom' : 'alphabetic'
      ctx.fillText(main, x, half ? y - 4 : y + 4)
      ctx.fillStyle = INK_MUTED
      ctx.font = `600 11px ${CHART_FONT.family}`
      ctx.textBaseline = 'top'
      ctx.fillText(sub, x, half ? y + 2 : y + 12)
      ctx.restore()
    },
  }
}
