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
  const sinceId = report.posts.length > 0 ? report.profile?.mostRecentPostId ?? undefined : undefined
  const postsResult = await gatherPosts(profile.id, {
    sinceId,
    maxResults: opts.backfill ?? 50,
  })
  addCost(username, postsResult.cost)

  const merged = mergePosts(report.posts, postsResult.data)

  // 3. Edges — recomputed locally from the full merged post set, free
  const edges = deriveEdges(profile.id, merged)

  updateReport(username, { posts: merged, edges })
}
