import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, HeatmapChart, LineChart, SankeyChart } from 'echarts/charts'
import { AriaComponent, GraphicComponent, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'
import { useTheme } from '@/hooks/useTheme'
import { chrome, type Mode } from '@/lib/colors'

echarts.use([BarChart, LineChart, HeatmapChart, SankeyChart, GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, MarkLineComponent, AriaComponent, GraphicComponent, SVGRenderer])

export type OptionBuilder = (mode: Mode, c: (typeof chrome)['light']) => EChartsCoreOption

/** Shared tooltip look: surface card, primary ink, hairline ring. */
export function tooltipStyle(c: (typeof chrome)['light']) {
  return {
    backgroundColor: c.surface,
    borderColor: c.grid,
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: c.ink, fontSize: 12, fontFamily: 'Inter Variable, system-ui, sans-serif' },
    extraCssText: 'border-radius:10px;box-shadow:0 8px 24px -8px rgba(0,0,0,.25);',
  }
}

export function axisStyle(c: (typeof chrome)['light']) {
  return {
    axisLine: { lineStyle: { color: c.axis } },
    axisTick: { show: false },
    axisLabel: { color: c.muted, fontSize: 11, fontFamily: 'Inter Variable, system-ui, sans-serif' },
    splitLine: { lineStyle: { color: c.grid, type: 'solid' as const } },
  }
}

export function EChart({ build, height, label, deps = [] }: { build: OptionBuilder; height: number; label: string; deps?: unknown[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)
  const [, mode] = useTheme()

  useEffect(() => {
    if (!ref.current) return
    chart.current = echarts.init(ref.current, undefined, { renderer: 'svg' })
    const ro = new ResizeObserver(() => chart.current?.resize())
    ro.observe(ref.current)
    return () => {
      ro.disconnect()
      chart.current?.dispose()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    const c = chrome[mode]
    chart.current?.setOption(
      { animationDuration: 300, aria: { enabled: true, label: { description: label } }, textStyle: { fontFamily: 'Inter Variable, system-ui, sans-serif' }, ...build(mode, c) },
      { notMerge: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, label, ...deps])

  return <div ref={ref} role="img" aria-label={label} style={{ height }} className="w-full" />
}
