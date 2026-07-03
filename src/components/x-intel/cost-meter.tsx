import { useXIntelStore } from '../../stores/x-intel-store'

export function CostMeter() {
  const sessionCost = useXIntelStore((s) => s.sessionCost)
  const activeTarget = useXIntelStore((s) => s.activeTarget)
  const targetCost = useXIntelStore((s) => (s.activeTarget ? s.reports[s.activeTarget]?.totalCost ?? 0 : 0))

  return (
    <div className="px-3 py-2 border-t border-white/[0.04] text-[10px] text-white/20 space-y-px">
      <div className="flex justify-between"><span>Session</span><span className="font-mono">${sessionCost.toFixed(3)}</span></div>
      {activeTarget && (
        <div className="flex justify-between"><span className="truncate">@{activeTarget}</span><span className="font-mono">${targetCost.toFixed(3)}</span></div>
      )}
    </div>
  )
}
