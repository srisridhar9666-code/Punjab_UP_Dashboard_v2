import { EChart, axisStyle, tooltipStyle } from './EChart'
import { chrome, seriesColor } from '@/lib/colors'
import { day, num } from '@/lib/format'
import type { Day } from '@/lib/types'

/** Daily interviews: complete + partial stacked (part of the day's total), 2px surface gap between segments. */
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
          axisPointer: { type: 'shadow', shadowStyle: { color: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' } },
          ...tooltipStyle(c),
          formatter: (ps: { dataIndex: number }[]) => {
            const d = data[ps[0].dataIndex]
            const rate = d.total ? Math.round((d.complete / d.total) * 100) : 0
            return `<b>${day(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</b><br/>Complete <b>${num(d.complete)}</b><br/>Partial <b>${num(d.partial)}</b><br/><span style="color:${c.muted}">${rate}% complete · ${num(d.total)} total</span>`
          },
        },
        xAxis: { type: 'category', data: data.map((d) => day(d.date)), ...axisStyle(c), splitLine: { show: false } },
        yAxis: { type: 'value', ...axisStyle(c), axisLine: { show: false } },
        series: [
          { name: 'Complete', type: 'bar', stack: 't', data: data.map((d) => d.complete), itemStyle: { color: seriesColor(0, mode), borderColor: c.surface, borderWidth: 1 }, barMaxWidth: 28 },
          { name: 'Partial', type: 'bar', stack: 't', data: data.map((d) => d.partial), itemStyle: { color: chrome[mode].other, borderRadius: [4, 4, 0, 0], borderColor: c.surface, borderWidth: 1 }, barMaxWidth: 28 },
        ],
      })}
    />
  )
}
