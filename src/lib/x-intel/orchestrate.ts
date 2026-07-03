import { gatherProfile, gatherPosts, gatherMentions } from './gather'
import { deriveEdges } from './normalize'
import { mergePosts, useXIntelStore, type RefreshedAt } from '../../stores/x-intel-store'

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
 * Full gather cycle for a target: profile → posts (incremental if we have
 * a mostRecentPostId) → local edge derivation. Updates the store and cost meter.
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

  // 2. Posts — incremental via since_id when we have prior posts
  // Re-read the current state to avoid a stale snapshot
  const currentReport = useXIntelStore.getState().reports[username]
  const sinceId = currentReport && currentReport.posts.length > 0
    ? currentReport.profile?.mostRecentPostId ?? undefined
    : undefined
  const postsResult = await gatherPosts(profile.id, {
    sinceId,
    maxResults: opts.backfill ?? 50,
  })
  addCost(username, postsResult.cost)

  // Re-read posts right before merging to avoid stale snapshot from concurrent gathers
  const existingPosts = useXIntelStore.getState().reports[username]?.posts ?? []
  const merged = mergePosts(existingPosts, postsResult.data)

  // 3. Edges — recomputed locally from the full merged post set, free
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
