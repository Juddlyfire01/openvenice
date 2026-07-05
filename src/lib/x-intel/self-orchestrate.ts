// Orchestration for the connected user's OWN data (Profile tab). Reuses the
// exact analytics + synthesis pipeline that targets use, so the self-report is
// structurally identical to a target report (everything a target has) — plus
// bookmarks/likes context the target path can't access.
import { gatherSelfProfile, gatherSelfPosts, gatherSelfBookmarks, gatherSelfLikes } from './self-gather'
import { getSelfSession } from './self-client'
import { deriveEdges } from './normalize'
import { computeAnalytics, computeDelta, postDateRange } from './analytics'
import { synthesizeReport } from './synthesize'
import { mergePosts, newReportId, useXIntelStore } from '../../stores/x-intel-store'
import { useXSelfStore } from '../../stores/x-self-store'
import { runGather } from './orchestrate'
import { DEFAULT_TARGET } from './fields'
import { DEFAULT_SYNTHESIS_SETTINGS } from './types'
import type { IntelReportSnapshot, ChangeSummary } from './types'

/**
 * Probe the server session and reflect it into the store. On the first
 * successful connect with an empty target list, seed the default target
 * (@AskVenice) so the Targets tab isn't empty — mirroring the old behaviour
 * that used to run on bearer-token connect. The seed gather authenticates
 * through the same OAuth proxy as everything else.
 */
export async function refreshSelfSession(): Promise<boolean> {
  const { connected } = await getSelfSession()
  useXSelfStore.getState().setConnected(connected)
  if (connected) seedDefaultTarget()
  return connected
}

/** Add @AskVenice as the first target (and gather it) when none exist yet. */
function seedDefaultTarget(): void {
  const intel = useXIntelStore.getState()
  if (intel.targets.length > 0) return
  intel.addTarget(DEFAULT_TARGET)
  runGather(DEFAULT_TARGET).catch(() => { /* surfaced in the target rail */ })
}

/** Full gather of the connected user: profile → posts → bookmarks → likes → edges. */
export async function gatherSelf(opts: { maxResults?: number } = {}): Promise<void> {
  const store = useXSelfStore.getState()

  const profile = await gatherSelfProfile()
  store.setProfile(profile)
  store.markRefreshed('profile')

  const [posts, bookmarks, likes] = await Promise.all([
    gatherSelfPosts(profile.id, opts).catch(() => [] as never[]),
    gatherSelfBookmarks(profile.id, opts).catch(() => [] as never[]),
    gatherSelfLikes(profile.id, opts).catch(() => [] as never[]),
  ])

  const mergedPosts = mergePosts(useXSelfStore.getState().posts, posts)
  store.setPosts(mergedPosts)
  store.markRefreshed('posts')

  store.setBookmarks(mergePosts(useXSelfStore.getState().bookmarks, bookmarks))
  store.markRefreshed('bookmarks')

  store.setLikes(mergePosts(useXSelfStore.getState().likes, likes))
  store.markRefreshed('likes')

  store.setEdges(deriveEdges(profile.id, mergedPosts))
}

/** Refresh only the self profile (cheap identity/metrics refresh). */
export async function refreshSelfProfile(): Promise<void> {
  const store = useXSelfStore.getState()
  const profile = await gatherSelfProfile()
  store.setProfile(profile)
  store.markRefreshed('profile')
}

/** Generate a full intelligence report over the connected user's own posts. */
export async function generateSelfReport(): Promise<IntelReportSnapshot> {
  const state = useXSelfStore.getState()
  if (!state.profile) throw new Error('Load your profile first')
  if (state.posts.length === 0) throw new Error('Gather your posts first')

  const settings = DEFAULT_SYNTHESIS_SETTINGS
  const analytics = computeAnalytics(state.profile, state.posts, state.edges)
  const prevSnapshot = state.reportHistory[0] ?? null

  let computedDelta: Omit<ChangeSummary, 'narrative'> | null = null
  if (prevSnapshot) {
    const prevIds = new Set(prevSnapshot.meta.postIdsAnalyzed)
    const newPostIds = state.posts.map((p) => p.id).filter((id) => !prevIds.has(id))
    const newPosts = state.posts.filter((p) => !prevIds.has(p.id))
    computedDelta = computeDelta(prevSnapshot.analytics, analytics, newPostIds, postDateRange(newPosts))
  }

  const { narrative, changeNarrative, tokenCost } = await synthesizeReport(
    state.profile, state.posts, analytics, computedDelta, prevSnapshot, settings,
  )

  const snapshot: IntelReportSnapshot = {
    id: newReportId(),
    createdAt: new Date().toISOString(),
    model: settings.model,
    synthesisSettings: { ...settings },
    meta: {
      postCount: state.posts.length,
      dateRange: postDateRange(state.posts),
      postIdsAnalyzed: state.posts.map((p) => p.id),
      tokenCost,
    },
    analytics,
    narrative,
    changeSummary: computedDelta ? { ...computedDelta, narrative: changeNarrative ?? '' } : null,
    previousReportId: prevSnapshot?.id ?? null,
  }

  useXSelfStore.getState().appendReport(snapshot)
  return snapshot
}
