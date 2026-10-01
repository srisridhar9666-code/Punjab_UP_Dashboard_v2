import { EChart, tooltipStyle } from './EChart'
import { SEQ } from '@/lib/colors'
import { day, num } from '@/lib/format'
import type { Heatmap } from '@/lib/types'

/** District x day completes on one blue sequential ramp (near zero recedes to the surface). */
export function HeatmapChart({ data, maxRows = 24 }: { data: Heatmap; maxRows?: number }) {
  const rows = data.rows.slice(0, maxRows)
  const cells = rows.flatMap((r, y) => r.values.map((v, x) => [x, y, v || null]))
  const max = Math.max(1, ...rows.flatMap((r) => r.values))
  return (
    <EChart
      label="Completed interviews per district per day"
      height={Math.max(180, rows.length * 22 + 70)}
      deps={[data]}
      build={(mode, c) => ({
        grid: { left: 8, right: 8, top: 4, bottom: 44, containLabel: true },
        tooltip: {
          ...tooltipStyle(c),
          formatter: (p: { value: [number, number, number | null] }) =>
            `<b>${rows[p.value[1]].district}</b><br/>${day(data.dates[p.value[0]], { weekday: 'short', day: 'numeric', month: 'short' })}: <b>${num(p.value[2] ?? 0)}</b> complete`,
        },
        xAxis: { type: 'category', data: data.dates.map((d) => day(d)), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: c.muted, fontSize: 10.5 }, splitArea: { show: false } },
        yAxis: { type: 'category', data: rows.map((r) => r.district), inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: c.ink2, fontSize: 11.5 } },
        visualMap: {
          min: 0, max, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 10, itemHeight: 140,
          text: [num(max), '0'], textStyle: { color: c.muted, fontSize: 11 },
          inRange: { color: mode === 'dark' ? ['#104281', '#256abf', '#5598e7', '#9ec5f4'] : [SEQ[0], SEQ[4], SEQ[8], SEQ[12]] },
        },
        series: [{ type: 'heatmap', data: cells, itemStyle: { borderColor: c.surface, borderWidth: 2, borderRadius: 3 }, emphasis: { itemStyle: { borderColor: c.ink, borderWidth: 1 } } }],
      })}
    />
  )
}
