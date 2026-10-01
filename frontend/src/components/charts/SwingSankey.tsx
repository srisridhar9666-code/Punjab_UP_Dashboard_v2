import { EChart, tooltipStyle } from './EChart'
import { partyColor } from '@/lib/colors'
import { num } from '@/lib/format'
import type { Swing } from '@/lib/types'

/** Where each party's past voters say they'll go now. Left = earlier vote, right = current intention. */
export function SwingSankey({ data, fromLabel, toLabel, height = 420 }: { data: Swing; fromLabel: string; toLabel: string; height?: number }) {
  const L = (p: string) => `${p} `
  const R = (p: string) => ` ${p}`
  // Hide labels on slivers (< 1.5% of the sample) so they don't collide; the tooltip still has them.
  const fromTot: Record<string, number> = {}
  const toTot: Record<string, number> = {}
  for (const f of data.flows) {
    fromTot[f.from] = (fromTot[f.from] ?? 0) + f.count
    toTot[f.to] = (toTot[f.to] ?? 0) + f.count
  }
  const big = (n: number | undefined) => (n ?? 0) / (data.base || 1) >= 0.015
  return (
    <EChart
      label={`Voter flow from ${fromLabel} to ${toLabel}`}
      height={height}
      deps={[data]}
      build={(mode, c) => ({
        tooltip: {
          ...tooltipStyle(c),
          formatter: (p: { dataType: string; data: { source?: string; target?: string; value: number; name?: string } }) => {
            if (p.dataType === 'edge')
              return `<b>${p.data.source!.trim()}</b> → <b>${p.data.target!.trim()}</b><br/>${num(p.data.value)} respondents (${((p.data.value / data.base) * 100).toFixed(1)}%)`
            return `<b>${p.data.name!.trim()}</b><br/>${num(p.data.value)} respondents`
          },
        },
        series: [
          {
            type: 'sankey',
            left: 4, right: 4, top: 26, bottom: 8,
            nodeWidth: 10, nodeGap: 10, nodeAlign: 'justify', layoutIterations: 0, draggable: false,
            emphasis: { focus: 'adjacency' },
            label: { color: c.ink2, fontSize: 12, formatter: (p: { name: string; value: number }) => `${p.name.trim() === "Don't know / no answer" ? 'No answer' : p.name.trim()}  {v|${((p.value / data.base) * 100).toFixed(0)}%}`, rich: { v: { color: c.muted, fontSize: 11 } } },
            lineStyle: { color: 'source', opacity: mode === 'dark' ? 0.35 : 0.28, curveness: 0.5 },
            itemStyle: { borderWidth: 0 },
            data: [
              ...data.nodes.filter((n) => fromTot[n]).map((n) => ({ name: L(n), itemStyle: { color: partyColor(n, mode) }, label: { show: big(fromTot[n]) } })),
              ...data.nodes.filter((n) => toTot[n]).map((n) => ({ name: R(n), itemStyle: { color: partyColor(n, mode) }, label: { position: 'left', show: big(toTot[n]) } })),
            ],
            links: data.flows.filter((f) => f.count > 0).map((f) => ({ source: L(f.from), target: R(f.to), value: f.count })),
          },
        ],
        graphic: [
          { type: 'text', left: 4, top: 0, style: { text: fromLabel, fill: c.muted, fontSize: 11, fontWeight: 500 } },
          { type: 'text', right: 4, top: 0, style: { text: toLabel, fill: c.muted, fontSize: 11, fontWeight: 500, align: 'right' } },
        ],
      })}
    />
  )
}
