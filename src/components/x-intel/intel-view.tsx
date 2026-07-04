import { useEffect, useRef } from 'react'
import { useXIntelStore, type IntelSubTab } from '../../stores/x-intel-store'
import { TargetRail } from './target-rail'
import { ActivityFeed } from './activity-feed'
import { ProfileCard } from './profile-card'
import { ProfileReport } from './profile-report'
import { NetworkGraph } from './network-graph'
import { DraftWorkspace } from './draft-workspace'
import { runGather } from '../../lib/x-intel/orchestrate'
import { SubTabs } from '../ui/sub-tabs'

const SUB_TABS = [
  { id: 'profile' as const, label: 'Profile' },
  { id: 'feed' as const, label: 'Feed' },
  { id: 'network' as const, label: 'Network' },
  { id: 'draft' as const, label: 'Post' },
]

export function IntelView() {
  const activeSubTab = useXIntelStore((s) => s.activeSubTab)
  const setActiveSubTab = useXIntelStore((s) => s.setActiveSubTab)

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
        <SubTabs tabs={SUB_TABS} value={activeSubTab} onChange={setActiveSubTab} className="px-4" size="sm" />
        <div className="flex-1 min-h-0">
          {activeSubTab === 'profile' && (
            <div className="flex flex-col lg:flex-row h-full min-h-0">
              <div className="lg:w-[340px] lg:shrink-0 lg:border-r border-white/[0.05] lg:h-full min-h-0 overflow-hidden">
                <ProfileCard />
              </div>
              <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
                <ProfileReport />
              </div>
            </div>
          )}
          {activeSubTab === 'network' && <NetworkGraph />}
          {activeSubTab === 'feed' && <ActivityFeed />}
          {activeSubTab === 'draft' && <DraftWorkspace />}
        </div>
      </div>
    </div>
  )
}
