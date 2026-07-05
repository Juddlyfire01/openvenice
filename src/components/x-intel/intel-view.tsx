import { useEffect, useRef } from 'react'
import { useXIntelStore } from '../../stores/x-intel-store'
import { TargetRail } from './target-rail'
import { ActivityFeed } from './activity-feed'
import { ProfileCard } from './profile-card'
import { ProfileReport } from './profile-report'
import { NetworkGraph } from './network-graph'
import { DraftWorkspace } from './draft-workspace'
import { SelfProfileView } from './self-profile-view'
import { runGather } from '../../lib/x-intel/orchestrate'
import { SubTabs } from '../ui/sub-tabs'

// Top-level split: your own OAuth profile vs. target analysis.
const TOP_TABS = [
  { id: 'me' as const, label: 'Profile' },
  { id: 'targets' as const, label: 'Targets' },
]

export function IntelView() {
  const activeSubTab = useXIntelStore((s) => s.activeSubTab)
  const setActiveSubTab = useXIntelStore((s) => s.setActiveSubTab)
  const activeTopTab = useXIntelStore((s) => s.activeTopTab)
  const setActiveTopTab = useXIntelStore((s) => s.setActiveTopTab)
  const targetCount = useXIntelStore((s) => s.targets.length)

  // The old per-target "Profile" sub-tab is renamed to Target/Targets, plural
  // only when more than one target is loaded (dynamic per your spec).
  const targetLabel = targetCount > 1 ? 'Targets' : 'Target'
  const subTabs = [
    { id: 'profile' as const, label: targetLabel },
    { id: 'feed' as const, label: 'Feed' },
    { id: 'network' as const, label: 'Network' },
    { id: 'draft' as const, label: 'Post' },
  ]

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
    <div className="flex flex-col h-full min-h-0">
      <SubTabs tabs={TOP_TABS} value={activeTopTab} onChange={setActiveTopTab} className="px-4" />

      {activeTopTab === 'me' ? (
        <div className="flex-1 min-h-0">
          <SelfProfileView />
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          <TargetRail />

          <div className="flex flex-col flex-1 min-w-0">
            <SubTabs tabs={subTabs} value={activeSubTab} onChange={setActiveSubTab} className="px-4" size="sm" />
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
      )}
    </div>
  )
}
