import { gatherProfile, gatherPosts, gatherMentions } from './gather'
import { deriveEdges } from './normalize'
import { computeAnalytics, computeDelta, postDateRange } from './analytics'
import { synthesizeReport } from './synthesize'
import { mergePosts, useXIntelStore, newReportId, type RefreshedAt } from '../../stores/x-intel-store'
import type { IntelReportSnapshot, Post } from './types'

/**
 * Build the next refreshedAt map for a report, stamping the given section(s) with
 * the current time. Called only after a gather resolves successfully — so a
 * "nothing new" (HTTP 200, zero posts) refresh still records that we checked,
 * while a thrown fetch never reaches here and leaves the old timestamp intact.
 */
function markRefreshed(username: string, ...sections: (keyof RefreshedAt)[]): RefreshedAt {
  const prev = useXIntelStore.getState().reports[username]?.refreshedAt ?? {}
  const now = new Date().toISOString()
  const next: RefreshedAt = { ...prev }
  for (const s of sections) next[s] = now
  return next
}

/**
 * The "everything" pull for a target: profile → outbound posts (incremental if
 * we have a mostRecentPostId) + inbound mentions → local edge derivation.
 * Updates the store and cost meter. Backs the Profile tab's Refresh button and
 * the initial gather when a target is added. A mentions hiccup is non-fatal —
 * posts still land — so the core timeline is never lost to an inbound failure.
 */
export async function runGather(username: string, opts: { backfill?: number } = {}): Promise<void> {
  const { updateReport, addCost } = useXIntelStore.getState()
  const report = useXIntelStore.getState().reports[username]
  if (!report) throw new Error(`No report for ${username}`)

  // 1. Profile — always refresh (cheap, metrics change)
  const profileResult = await gatherProfile(username)
  addCost(username, profileResult.cost)
  const profile = profileResult.data
  updateReport(username, { profile })

  // 2. Posts (outbound, incremental via since_id) + mentions (inbound), in parallel
  // Re-read the current state to avoid a stale snapshot
  const currentReport = useXIntelStore.getState().reports[username]
  const sinceId = currentReport && currentReport.posts.length > 0
    ? currentReport.profile?.mostRecentPostId ?? undefined
    : undefined
  const [postsResult, mentionsResult] = await Promise.all([
    gatherPosts(profile.id, { sinceId, maxResults: opts.backfill ?? 50 }),
    gatherMentions(profile.id).catch(() => ({ data: [] as Post[], cost: 0 })),
  ])
  addCost(username, postsResult.cost)
  addCost(username, mentionsResult.cost)

  // Re-read posts right before merging to avoid stale snapshot from concurrent gathers
  const existingPosts = useXIntelStore.getState().reports[username]?.posts ?? []
  const merged = mergePosts(mergePosts(existingPosts, postsResult.data), mentionsResult.data)

  // 3. Edges — recomputed locally from the full merged post set (outbound + inbound), free
  const edges = deriveEdges(profile.id, merged)

  updateReport(username, { posts: merged, edges, refreshedAt: markRefreshed(username, 'profile', 'feed', 'network') })
}

/**
 * Refresh only the target's profile (metrics, bio, avatar). Cheapest single
 * refresh — one user lookup — used by the Profile section's Refresh action.
 */
export async function refreshProfile(username: string): Promise<void> {
  const { updateReport, addCost } = useXIntelStore.getState()
  const report = useXIntelStore.getState().reports[username]
  if (!report) throw new Error(`No report for ${username}`)

  const result = await gatherProfile(username)
  addCost(username, result.cost)
  updateReport(username, { profile: result.data, refreshedAt: markRefreshed(username, 'profile') })
}

/**
 * Refresh the target's posts (incremental when we already hold posts), then
 * re-derive network edges from the merged set. Backs both the Feed section
 * and the Network section's base refresh.
 */
export async function refreshPosts(username: string): Promise<void> {
  const { updateReport, addCost } = useXIntelStore.getState()
  const report = useXIntelStore.getState().reports[username]
  if (!report) throw new Error(`No report for ${username}`)

  // Need a profile id to query posts; fetch it first if we don't have one yet.
  let profileId = report.profile?.id
  if (!profileId) {
    const profileResult = await gatherProfile(username)
    addCost(username, profileResult.cost)
    updateReport(username, { profile: profileResult.data, refreshedAt: markRefreshed(username, 'profile') })
    profileId = profileResult.data.id
  }

  const sinceId = report.posts.length > 0 ? report.profile?.mostRecentPostId ?? undefined : undefined
  const postsResult = await gatherPosts(profileId, { sinceId })
  addCost(username, postsResult.cost)

  const existingPosts = useXIntelStore.getState().reports[username]?.posts ?? []
  const merged = mergePosts(existingPosts, postsResult.data)
  const edges = deriveEdges(profileId, merged)
  // Stamp feed + network on every success — a zero-new-posts pull still means
  // "checked just now", so the label must move even though `merged` is unchanged.
  updateReport(username, { posts: merged, edges, refreshedAt: markRefreshed(username, 'feed', 'network') })
}

/**
 * Enrich the network with inbound engagement: who is mentioning the target.
 * Uses the (previously unwired) mentions endpoint, merges the returned posts
 * into the store, and re-derives edges so the graph reflects both outbound
 * (target → others) and inbound (others → target) activity.
 */
export async function refreshNetworkWithMentions(username: string): Promise<void> {
  const { updateReport, addCost } = useXIntelStore.getState()
  const report = useXIntelStore.getState().reports[username]
  if (!report) throw new Error(`No report for ${username}`)

  let profileId = report.profile?.id
  if (!profileId) {
    const profileResult = await gatherProfile(username)
    addCost(username, profileResult.cost)
    updateReport(username, { profile: profileResult.data, refreshedAt: markRefreshed(username, 'profile') })
    profileId = profileResult.data.id
  }

  const mentionsResult = await gatherMentions(profileId)
  addCost(username, mentionsResult.cost)

  const existingPosts = useXIntelStore.getState().reports[username]?.posts ?? []
  const merged = mergePosts(existingPosts, mentionsResult.data)
  const edges = deriveEdges(profileId, merged)
  updateReport(username, { posts: merged, edges, refreshedAt: markRefreshed(username, 'network', 'feed') })
}

/**
 * Generate a comprehensive intelligence report over the CURRENTLY-STORED posts
 * (no gather, no X cost). Computes deterministic analytics, diffs against the
 * previous report when one exists, asks Venice to interpret both, and appends an
 * immutable snapshot to the report ledger. Returns the new snapshot.
 *
 * Analytics are frozen into the snapshot so historical reports never drift when
 * post metrics change on a later re-gather.
 */
export async function generateReport(username: string): Promise<IntelReportSnapshot> {
  const { appendReport } = useXIntelStore.getState()
  const report = useXIntelStore.getState().reports[username]
  if (!report) throw new Error(`No report for ${username}`)
  if (!report.profile) throw new Error('Gather the profile first')
  if (report.posts.length === 0) throw new Error('Gather posts first (re-gather from the target rail)')

  const analytics = computeAnalytics(report.profile, report.posts, report.edges)
  const prevSnapshot = report.reportHistory[0] ?? null

  // Computed delta vs. the previous report (baseline = null)
  let computedDelta: Omit<import('./types').ChangeSummary, 'narrative'> | null = null
  if (prevSnapshot) {
    const prevIds = new Set(prevSnapshot.meta.postIdsAnalyzed)
    const newPostIds = report.posts.map((p) => p.id).filter((id) => !prevIds.has(id))
    const newPosts = report.posts.filter((p) => !prevIds.has(p.id))
    computedDelta = computeDelta(prevSnapshot.analytics, analytics, newPostIds, postDateRange(newPosts))
  }

  const { narrative, changeNarrative, tokenCost } = await synthesizeReport(
    report.profile,
    report.posts,
    analytics,
    computedDelta,
    prevSnapshot,
    report.synthesisSettings,
  )

  const snapshot: IntelReportSnapshot = {
    id: newReportId(),
    createdAt: new Date().toISOString(),
    model: report.synthesisSettings.model,
    synthesisSettings: { ...report.synthesisSettings },
    meta: {
      postCount: report.posts.length,
      dateRange: postDateRange(report.posts),
      postIdsAnalyzed: report.posts.map((p) => p.id),
      tokenCost,
    },
    analytics,
    narrative,
    changeSummary: computedDelta ? { ...computedDelta, narrative: changeNarrative ?? '' } : null,
    previousReportId: prevSnapshot?.id ?? null,
  }

  appendReport(username, snapshot)
  return snapshot
}
