import { useState, type ReactNode } from 'react'
import { BarChart3, Download, Table2 } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tip } from '@/components/ui/Overlay'
import { downloadCsv } from '@/lib/csv'
import { cn } from '@/lib/cn'

type Row = Record<string, string | number | null>

/** A chart with a one-click table view (the accessible twin of every chart) and CSV export. */
export function ChartCard({
  title, subtitle, table, filename, actions, children, className, bodyClass, loading,
}: {
  title: ReactNode
  subtitle?: ReactNode
  table?: Row[]
  filename?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClass?: string
  loading?: boolean
}) {
  const [asTable, setAsTable] = useState(false)
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {actions}
            {table && (
              <Tip content={asTable ? 'Show chart' : 'Show as table'}>
                <Button size="icon" variant="ghost" aria-label={asTable ? 'Show chart' : 'Show as table'} onClick={() => setAsTable((v) => !v)}>
                  {asTable ? <BarChart3 className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
                </Button>
              </Tip>
            )}
            {table && filename && (
              <Tip content="Download CSV">
                <Button size="icon" variant="ghost" aria-label="Download CSV" onClick={() => downloadCsv(filename, table)}>
                  <Download className="h-4 w-4" />
                </Button>
              </Tip>
            )}
          </>
        }
      />
      <div className={cn('flex-1 px-5 pb-5 pt-4 transition-opacity', loading && 'opacity-60', bodyClass)}>{asTable && table ? <DataTable rows={table} /> : children}</div>
    </Card>
  )
}

export function DataTable({ rows }: { rows: Row[] }) {
  if (!rows.length) return <p className="text-[13px] text-ink-3">No rows.</p>
  const cols = Object.keys(rows[0])
  return (
    <div className="scroll-thin max-h-[420px] overflow-auto rounded-lg border hairline">
      <table className="w-full text-[12.5px]">
        <thead className="sticky top-0 bg-raised">
          <tr>
            {cols.map((c) => (
              <th key={c} className="border-b hairline px-3 py-2 text-left font-medium text-ink-3">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b hairline last:border-0">
              {cols.map((c) => (
                <td key={c} className={cn('px-3 py-1.5', typeof r[c] === 'number' && 'tabular text-right')}>
                  {r[c] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
