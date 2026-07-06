import { formatTokens } from '../utils'

export function fmtUsd(n: number, digits = 2): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(digits)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(digits)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(digits)}K`
  if (abs >= 100) return `${sign}$${abs.toFixed(2)}`
  if (abs >= 1) return `${sign}$${abs.toFixed(digits)}`
  return `${sign}$${abs.toFixed(4)}`
}

/** Full dollar amount for a single token/unit price (no K/M/B shorthand). */
export function fmtUnitUsd(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 100) {
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  if (n >= 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(4)}`
}

export function fmtPct(n: number, signed = true): string {
  const sign = signed && n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

export function fmtRatio(n: number): string {
  return `${(n * 100).toFixed(2)}%`
}

export function fmtToken(n: number, suffix?: string, digits?: number): string {
  let base: string
  if (digits != null) {
    const abs = Math.abs(n)
    const sign = n < 0 ? '-' : ''
    if (abs >= 1_000_000) base = `${sign}${(abs / 1_000_000).toFixed(digits)}M`
    else if (abs >= 1_000) base = `${sign}${(abs / 1_000).toFixed(digits)}K`
    else base = `${sign}${abs.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
  } else {
    base = formatTokens(n)
  }
  return suffix ? `${base} ${suffix}` : base
}

export function relUpdated(iso: string | null | undefined): string {
  if (!iso) return 'unknown'
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
