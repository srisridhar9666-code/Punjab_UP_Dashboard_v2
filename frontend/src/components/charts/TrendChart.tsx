import { EChart, axisStyle, tooltipStyle } from './EChart'
import { seriesColor } from '@/lib/colors'
import { day, num } from '@/lib/format'
import type { Day } from '@/lib/types'

/** Daily surveys: complete and partial as lines, complete shaded. */
export function TrendChart({ data, height = 260 }: { data: Day[]; height?: number }) {
  return (
    <EChart
      label={`Daily interviews, ${data.length} days`}
      height={height}
      deps={[data]}
      build={(mode, c) => ({
        grid: { left: 8, right: 8, top: 28, bottom: 4, containLabel: true },
        legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: c.ink2, fontSize: 12 } },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'line', lineStyle: { color: c.axis } },
          ...tooltipStyle(c),
          formatter: (ps: { dataIndex: number }[]) => {
            const d = data[ps[0].dataIndex]
            const rate = d.total ? Math.round((d.complete / d.total) * 100) : 0
            return `<b>${day(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</b><br/>Complete <b>${num(d.complete)}</b><br/>Partial <b>${num(d.partial)}</b><br/><span style="color:${c.muted}">${rate}% complete · ${num(d.total)} total</span>`
          },
        },
        xAxis: { type: 'category', boundaryGap: false, data: data.map((d) => day(d.date)), ...axisStyle(c), splitLine: { show: false } },
        yAxis: { type: 'value', ...axisStyle(c), axisLine: { show: false } },
        series: [
          {
            name: 'Complete',
            type: 'line',
            smooth: 0.3,
            symbol: 'circle',
            symbolSize: 7,
            showSymbol: data.length <= 31,
            lineStyle: { width: 2.5, color: seriesColor(0, mode) },
            itemStyle: { color: seriesColor(0, mode), borderColor: c.surface, borderWidth: 2 },
            areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: seriesColor(0, mode) + '40' }, { offset: 1, color: seriesColor(0, mode) + '00' }] } },
            data: data.map((d) => d.complete),
          },
          {
            name: 'Partial',
            type: 'line',
            smooth: 0.3,
            symbol: 'circle',
            symbolSize: 6,
            showSymbol: data.length <= 31,
            lineStyle: { width: 2, color: seriesColor(1, mode) },
            itemStyle: { color: seriesColor(1, mode), borderColor: c.surface, borderWidth: 2 },
            data: data.map((d) => d.partial),
          },
        ],
      })}
    />
  )
}
