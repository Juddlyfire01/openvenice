import type { ReactNode } from 'react'
import { cn } from '../../../lib/utils'
import type { VeniceDataPoint } from '../../../lib/venicestats/types'

export function StatsSection({
  title,
  href,
  children,
}: {
  title: string
  href?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate min-w-0">{title}</h2>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors shrink-0"
          >
            View on VeniceStats →
          </a>
        )}
      </div>
      {children}
    </section>
  )
}

function CardLabel({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--color-text-secondary)] truncate">
      {children}
    </div>
  )
}

const cardHoverCls =
  'transition-colors hover:border-[var(--color-accent)]/35 hover:bg-[var(--color-accent)]/[0.04]'

export function KpiCard({
  label,
  value,
  sub,
  delta,
  className,
  tip,
}: {
  label: string
  value: string
  sub?: string
  delta?: { text: string; positive?: boolean }
  className?: string
  tip?: string
}) {
  return (
    <div
      title={tip}
      className={cn(
        'rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-bg-raised)] px-3.5 py-3 min-h-[5.5rem] flex flex-col justify-between',
        cardHoverCls,
        className,
      )}
    >
      <CardLabel>{label}</CardLabel>
      <div>
        <div className="text-[18px] font-semibold font-mono leading-tight text-[var(--color-text-primary)]">
          {value}
        </div>
        {delta && (
          <div className={cn('text-[11px] font-mono mt-0.5', delta.positive === true ? 'text-green-400/75' : delta.positive === false ? 'text-red-400/75' : 'text-[var(--color-text-secondary)]')}>
            {delta.text}
          </div>
        )}
        {sub && <div className="text-[10px] text-[var(--color-text-secondary)] font-mono mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

export function ChartCard({
  title,
  children,
  className,
  tip,
}: {
  title: string
  children: ReactNode
  className?: string
  tip?: string
}) {
  return (
    <div
      title={tip}
      className={cn(
        'rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-bg-raised)] p-3',
        cardHoverCls,
        className,
      )}
    >
      <div className="mb-2">
        <CardLabel>{title}</CardLabel>
      </div>
      {children}
    </div>
  )
}

/** Normalize API chart rows — simple `{t,v}` or burns buckets with a value key. */
export function normalizeChartSeries(
  raw: Array<{ t: number; v?: number; [key: string]: unknown }> | undefined,
  valueKey?: string,
): VeniceDataPoint[] {
  if (!raw?.length) return []
  return raw
    .map((p) => {
      let v = p.v
      if (!Number.isFinite(v) && valueKey) {
        const alt = p[valueKey]
        v = typeof alt === 'number' ? alt : NaN
      }
      return { t: p.t, v: v as number }
    })
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
}

/** Lightweight SVG line chart — no chart library dependency. */
export function LineChart({
  data,
  color = 'var(--color-accent)',
  height = 140,
  className,
}: {
  data: VeniceDataPoint[]
  color?: string
  height?: number
  className?: string
}) {
  const series = data.filter((d) => Number.isFinite(d.t) && Number.isFinite(d.v))
  if (!series.length) {
    return (
      <div className={cn('flex items-center justify-center text-[11px] text-[var(--color-text-secondary)]', className)} style={{ height }}>
        No chart data
      </div>
    )
  }

  const w = 400
  const h = height
  const pad = { t: 8, r: 8, b: 20, l: 8 }
  const innerW = w - pad.l - pad.r
  const innerH = h - pad.t - pad.b
  const values = series.map((d) => d.v)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = series.map((d, i) => {
    const x = pad.l + (i / Math.max(1, series.length - 1)) * innerW
    const y = pad.t + innerH - ((d.v - min) / range) * innerH
    return `${x},${y}`
  })

  const start = new Date(series[0].t)
  const end = new Date(series[series.length - 1].t)
  const fmt = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' })

  return (
    <div className={cn('w-full', className)}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" role="img" aria-label={titleFromData(series)}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={pad.l}
            x2={w - pad.r}
            y1={pad.t + innerH * f}
            y2={pad.t + innerH * f}
            stroke="var(--color-border-faint)"
            strokeWidth="1"
          />
        ))}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.75"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points.join(' ')}
        />
        <polyline
          fill={color}
          fillOpacity="0.08"
          stroke="none"
          points={`${pad.l},${pad.t + innerH} ${points.join(' ')} ${pad.l + innerW},${pad.t + innerH}`}
        />
      </svg>
      <div className="flex justify-between text-[9px] font-mono text-[var(--color-text-secondary)] mt-1 px-0.5">
        <span>{fmt(start)}</span>
        <span>{fmt(end)}</span>
      </div>
    </div>
  )
}

function titleFromData(data: VeniceDataPoint[]): string {
  if (data.length < 2) return 'Chart'
  const first = data[0]?.v
  const last = data[data.length - 1]?.v
  if (!Number.isFinite(first) || !Number.isFinite(last)) return 'Chart'
  const ch = first !== 0 ? ((last - first) / first) * 100 : 0
  return `Trend from ${first.toLocaleString()} to ${last.toLocaleString()} (${ch >= 0 ? '+' : ''}${ch.toFixed(1)}%)`
}

const PERIOD_OPTIONS = [
  ['7d', '7D'],
  ['30d', '30D'],
  ['90d', '90D'],
  ['1y', '1Y'],
  ['all', 'ALL'],
] as const

export function PeriodPicker<T extends string>({
  value,
  onChange,
}: {
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-px rounded-lg p-0.5 bg-[var(--color-bg-base)] border border-[var(--color-border-soft)]">
      {PERIOD_OPTIONS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id as T)}
          className={cn(
            'text-[10px] font-medium px-2 py-1 rounded-md transition-colors',
            value === id
              ? 'bg-[var(--color-bg-raised)] text-[var(--color-accent)] border border-[var(--color-accent)]/30'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
