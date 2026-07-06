import { useQuery } from '@tanstack/react-query'
import { fetchVeniceCharts, fetchVeniceMetrics } from '../lib/venicestats/client'
import type { VeniceChartPeriod } from '../lib/venicestats/types'

const METRICS_STALE = 60_000
const CHARTS_STALE = 5 * 60_000

export function useVeniceMetrics() {
  return useQuery({
    queryKey: ['venicestats', 'metrics'],
    queryFn: fetchVeniceMetrics,
    staleTime: METRICS_STALE,
    refetchInterval: METRICS_STALE,
  })
}

export function useVeniceCharts(period: VeniceChartPeriod) {
  return useQuery({
    queryKey: ['venicestats', 'charts', period],
    queryFn: () => fetchVeniceCharts(period),
    staleTime: CHARTS_STALE,
  })
}
