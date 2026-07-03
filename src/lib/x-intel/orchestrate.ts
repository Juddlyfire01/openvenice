import { gatherProfile, gatherPosts } from './gather'
import { deriveEdges } from './normalize'
import { mergePosts, useXIntelStore } from '../../stores/x-intel-store'

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

  updateReport(username, { posts: merged, edges })
}
