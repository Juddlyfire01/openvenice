import { useEffect, useRef } from 'react'
import { useXIntelStore, type IntelSubTab } from '../../stores/x-intel-store'
import { TargetRail } from './target-rail'
import { ActivityFeed } from './activity-feed'
import { ProfileCard } from './profile-card'
import { runGather } from '../../lib/x-intel/orchestrate'
import { cn } from '../../lib/utils'

const SUB_TABS: { id: IntelSubTab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'network', label: 'Network' },
  { id: 'feed', label: 'Feed' },
  { id: 'draft', label: 'Draft' },
]

export function IntelView() {
  const activeSubTab = useXIntelStore((s) => s.activeSubTab)
  const setActiveSubTab = useXIntelStore((s) => s.setActiveSubTab)
  const activeTarget = useXIntelStore((s) => s.activeTarget)

  const ranWatch = useRef(false)
  useEffect(() => {
    if (ranWatch.current) return
    ranWatch.current = true
    const { targets, reports } = useXIntelStore.getState()
    for (const t of targets) {
      if (reports[t]?.watch) runGather(t).catch(() => { /* surfaced on manual gather */ })
    }
  }, [])

  return (
    <div className="flex h-full">
      <TargetRail />

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-1 px-4 py-1.5 border-b border-white/[0.04]">
          {SUB_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveSubTab(id)}
              className={cn(
                'text-[11px] font-medium px-2.5 py-[3px] rounded-full transition-all duration-150',
                activeSubTab === id ? 'bg-white text-black' : 'bg-white/[0.03] text-white/20 hover:text-white/40 hover:bg-white/[0.05]',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0">
          {activeSubTab === 'profile' ? (
            <ProfileCard />
          ) : activeSubTab === 'feed' ? (
            <ActivityFeed />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-[12px] text-white/15">
                {activeTarget ? `${activeSubTab} — coming in later tasks` : 'No target selected'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
